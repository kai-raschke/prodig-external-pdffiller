'use strict';
const fs = require('fs');
const webdavClient = require('webdav-client');
const { lib } = require('@kai-raschke/prodig-external-deps')();

let uploadToNC = async function(outputFile, variablesIn, processVariables){
    variablesIn.outputName = variablesIn.outputName || variablesIn.formName;
    variablesIn.outputName = (
        process.env.NODE_ENV === 'production' ? variablesIn.outputName :
            (
                process.env.NODE_ENV === 'staging' ? `STAG_${variablesIn.outputName}` : `TEST_${variablesIn.outputName}`
            )
    );

    return new Promise(async (res, rej) => {
        try{
            const connection = new webdavClient.Connection({
                url: process.env.CLOUD_URL,
                authenticator: new webdavClient.BasicAuthenticator(),
                username: process.env.CLOUD_USER,
                password: process.env.CLOUD_PASS
            });

            //Check if folder is existing
            let folderExistsAsync = new Promise((resExists, rejExists) => {
                connection.exists(`/remote.php/webdav/records/${variablesIn.identifier}`, (err, exists) => {
                    if(err) rejExists(err);
                    resExists(exists);
                });
            });
            let folderExists = await folderExistsAsync;
            //console.log('folderExists', folderExists);

            //create folder if not existing
            if(!folderExists){
                let mkdirAsync = new Promise((resMkdir, rejMkdir) => {
                    connection.mkdir(`/remote.php/webdav/records/${variablesIn.identifier}`, (err, exists) => {
                        if(err) rejMkdir(err);
                        resMkdir(exists);
                    });
                });
                await mkdirAsync;
            }

            let folderExists2 = await folderExistsAsync;
            //console.log('folderExists', folderExists2);

            //upload file to nextcloud
            let fileStream = fs.createReadStream(outputFile);
            let outputFilePath = `${variablesIn.identifier}/${variablesIn.outputName}-${variablesIn.bKey}.pdf`;

            connection.put(`/remote.php/webdav/records/${outputFilePath}`, fileStream, async (err, body) => {
                if(err) rej(err);

                let share = await lib.requestAsync({
                    url: process.env.CLOUD_URL + '/ocs/v2.php/apps/files_sharing/api/v1/shares?format=json',
                    headers: {
                        authorization: "Basic " + Buffer.from(`${process.env.CLOUD_USER}:${process.env.CLOUD_PASS}`).toString('base64'),
                        'OCS-APIREQUEST': true,
                        'content-type': 'multipart/form-data'
                    },
                    method: 'POST',
                    formData: {
                        'shareType': 3,
                        'path': `/records/${outputFilePath}`
                    }
                }).catch((ex) => rej(ex));

                let result = {
                    fileLink: '',
                    preview: '',
                    filename: '',
                    fileid: ''
                };

                //console.log(share.body);
                share = JSON.parse(share.body);

                try{
                    if(!share || !share.ocs){
                        throw "Empty shareDetails";
                    }
                    else{
                        let data = share.ocs.data;
                        if(data) {
                            result.fileid = data.id;
                            result.fileLink = data.url;
                            result.filename = data.file_target;

                            //Fix for API not returning https share link
                            if(data.url.indexOf('http://') > -1)
                                result.fileLink = data.url.replace('http://', 'https://');
                        }
                    }
                }
                catch(ex){
                    console.error(ex);
                    rej(ex);
                }

                await lib.requestAsync({
                    url: process.env.CLOUD_URL + '/ocs/v2.php/apps/files_sharing/api/v1/shares/' + result.fileid,
                    headers: {
                        authorization: "Basic " + Buffer.from(`${process.env.CLOUD_USER}:${process.env.CLOUD_PASS}`).toString('base64'),
                        'OCS-APIREQUEST': true,
                        'content-type': 'application/x-www-form-urlencoded'
                    },
                    method: 'PUT',
                    form: {
                        'password': variablesIn.identifier
                    }
                });

                processVariables.set("nclink", result["fileLink"]);
                processVariables.set("ncpreview", result.preview);
                processVariables.set("ncname", result.filename);
                processVariables.set("ncfile", result.fileid);
                res(result);
            });
        }
        catch(ex){
            console.error(ex);
            rej(ex);
        }
    });
};

module.exports = uploadToNC;