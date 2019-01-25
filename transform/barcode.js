'use strict';
const path = require('path');
const fs   = require('fs');
const bwipjs = require('bwip-js');
const HummusRecipe = require('hummus-recipe');

let buildBarcodeData = function(barcodeDataObject){
    let barcodeDataArray = [];
    for(let key in barcodeDataObject){
        barcodeDataArray.push(
            `${key}=${barcodeDataObject[key]}`
        );
    }

    return barcodeDataArray.join('&');
};

let generateBarcode = async function(data, barcodePath){
    return new Promise((res, rej) => {
        bwipjs.toBuffer({
            bcid:        'datamatrix',    // Barcode type
            text:        data,            // Text to encode
            scale:       3,               // 3x scaling factor
            height:      28,              // Bar height, in millimeters
            includetext: false,            // Show human-readable text
        }, function (err, png) {
            if(err){
                rej(err);
            }
            else{
                fs.open(barcodePath, 'w', function(err, fd) {
                    if (err) {
                        rej(err);
                        throw 'could not open file: ' + err;
                    }

                    // write the contents of the buffer, from position 0 to the end, to the file descriptor returned in opening our file
                    fs.write(fd, png, 0, png.length, null, function(err) {
                        if (err) throw 'error writing file: ' + err;
                        fs.close(fd, function() {
                            res(barcodePath);
                        });
                    });
                });
            }
        });
    });
};

/**
 *
 * @param {string} inputFile - Absolute path of input file
 * @param {Object} proccessVariables - Proccess variables within current task
 * @param {string} outputFile - Optional absolute output path of transformed file, defaults to inputFile with timestamp
 * @return {Promise<string>} Returns absolute path of transformed file
 */
let addBarcode = async function(inputFile, proccessVariables, outputFile){
    let fileName = path.basename(inputFile, '.pdf');
    let filePath = path.parse(inputFile).dir;

    outputFile = outputFile || `${fileName}-${+new Date()}.pdf`;
    outputFile = path.join(filePath, outputFile);

    let data = buildBarcodeData({
        taskDefinitionKey: proccessVariables.inboxTask,
        processInstanceId: proccessVariables.processInstanceId,
        processInstanceBusinessKey: proccessVariables.bKey
    });

    let barcodePath = path.join(filePath, `${fileName}-barcode-${+new Date()}.png`);
    await generateBarcode(data, barcodePath);

    return new Promise((res, rej) => {
        let pdfDoc = new HummusRecipe(inputFile, outputFile);
        try{
            pdfDoc.editPage(1);
            pdfDoc.image(barcodePath, 540, 715, {width: 60, keepAspectRatio: true});
            pdfDoc.endPage();
            pdfDoc.endPDF(function(){
                fs.unlinkSync(barcodePath);
                res(outputFile);
            });
        }
        catch(ex) {
            console.error(ex);
            rej(ex);
        }
    });
};

module.exports = addBarcode;