'use strict';
const { File } = require('camunda-external-task-client-js');

let setFile = async function(localPath, variablesIn, processVariables){
    const file = await new File({ localPath }).load();
    processVariables.set(variablesIn.outputName, file);
};

module.exports = setFile;