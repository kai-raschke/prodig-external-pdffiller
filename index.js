'use strict';

const fs = require('fs'),
    path = require('path');
const { client, log, lib, gray } = require('@kai-raschke/prodig-external-deps')();
const { Variables } = require('camunda-external-task-client-js');
const pdfFiller = require('pdffiller');

const formPath        = "forms",
    outputPath      = "tmp";

//existsOrCreate output path
if (!fs.existsSync(outputPath)){
    fs.mkdirSync(outputPath);
}

let main = async function({ task, taskService }) {
    let   variablesIn       = task.variables.getAll();
    variablesIn.processInstanceId = task.processInstanceId;
    variablesIn.transform = variablesIn.transform || '';
    variablesIn.output = variablesIn.output || '';

    const processVariables  = new Variables();
    const processDefinitionKey = task.processDefinitionKey;

    //Delete 'null' values in process variables; pdffiller cannot work when leaving them in the object
    Object.entries(variablesIn).forEach(([key, val]) => {
        if (val == null) delete variablesIn[key];
    });

    if(!variablesIn.formName){
        await taskService.handleFailure(task, "An error occured - strange ...");
    }

    if(!variablesIn.identifier){
        await taskService.handleFailure(task, "An error occured - strange ...");
    }

    variablesIn.inboxTask = variablesIn.inboxTask || 'Task_DocInbox'; //Set default task for barcode scan inbox

    let tempOutputFile = path.join(__dirname, outputPath, `${variablesIn.outputName}-${variablesIn.bKey}-temp.pdf`);
    let outputFile = path.join(__dirname, outputPath, `${variablesIn.outputName}-${variablesIn.bKey}.pdf`);
    let tempFiles = [];

    try{
        // file goes to (outputPath, `${outputName}-${bKey}-temp.pdf`)
        await createPdf(variablesIn.formName, tempOutputFile, variablesIn);

        if(!fs.existsSync(tempOutputFile)){
            throw "File was not created.";
        }

        tempFiles.push(tempOutputFile);
    } catch(ex){
        console.error(ex);
        await taskService.handleFailure(task, {
            errorMessage: "An error occurred while creating the document.",
            errorDetails: `${ex.errno}; ${ex.code}; ${ex.syscall}`,
            retries: 0,
            retryTimeout: 1000
        });
    }

    //Do all transformations on newly created pdf with given transform variables from bpmn
    let transforms = variablesIn.transform.split(',');
    for(let i = -1; ++i < transforms.length;){
        let transform = transforms[i];
        transform = transform.trim();

        try{
            let module = require(`./transform/${transform}`);
            try{
                tempOutputFile = await module(tempOutputFile, variablesIn);
            } catch(ex){
                await taskService.handleFailure(task, "An error occurred while transforming the document.");
            }

            tempFiles.push(tempOutputFile);
        }
        catch(ex){
            console.error(ex);
        }
    }

    fs.copyFileSync(tempOutputFile, outputFile);
    tempFiles.push(outputFile);

    //Execute all outputs with transformed (or not) pdf given by input parameters from bpmn
    let outputs = variablesIn.output.split(',');
    for(let i = -1; ++i < outputs.length;){
        let output = outputs[i];
        output = output.trim();

        try{
            let module = require(`./output/${output}`);
            try{
                await module(outputFile, variablesIn, processVariables);
            } catch(ex){
                await taskService.handleFailure(task, "An error occurred while executing the output of the document.");
            }
        }
        catch(ex){
            console.error(ex);
        }
    }

    if(process.env.NODE_ENV !== 'development')
        removeTempFiles(tempFiles);

    await taskService.complete(task, processVariables);
};

let createPdf = async function(template, output, data){
    return new Promise(async (res,rej) => {
        data = data || {};
        try{
            //Erstellt die vorausgefüllte Form
            await fillForm(path.join(__dirname, formPath, `${template}.pdf`), output, data);
            res();
        }
        catch(ex){
            rej(ex);
        }
    });
};

let removeTempFiles = function(tempFiles){
    try{
        for(let i = -1; ++i < tempFiles.length;){
            let tempFile = tempFiles[i];
            fs.unlinkSync(tempFile);
        }
    } catch(ex){ console.log(ex); }
};

let fillForm = async function(source, destination, data, flatten){
    return new Promise((res, rej) => {
        try{
            //flatten = true;
            if(!flatten){
                if(process.env.NODE_ENV === "development"){
                    console.log(`Creating ${source} in ${destination} with data ${data}`);
                }

                pdfFiller.fillFormWithFlatten( source, destination, data, false, function(err) {
                    if (err) rej(err);
                    res();
                });
            }
            else{
                pdfFiller.fillForm( source, destination, data, function(err) {
                    if (err) rej(err);
                    res();
                });
            }
        }
        catch(ex){ console.error("FEHLER 2", ex); }
    });
};

(function start(){
    try {
        client.subscribe(process.env.TOPIC, main);
        client.start();

        if(process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'){
            //allow testing Camunda external task through http interface if in dev mode
            require('./mock').start(main);
        }
    } catch (e) {
        console.error(e);//log.error(e);
    }
})();