# prodig-external-pdffiller

A Node.js microservice for handling Adobe Acrobat PDF forms.

It can create, transform and handle the output.

The project is based on camunda sdk, pdffiller (which utilizes ptftk) and a support package
([prodig-external-deps](https://www.npmjs.com/package/@kai-raschke/prodig-external-deps)).

It was built with PM2 as process manager in mind so all settings are set in the
app.json file in a [PM2 process file](http://pm2.keymetrics.io/docs/usage/application-declaration/) 
format.

For more information about our project, in which we use this service, you can visit our
webpage [Prodig@Students](https://prodig.uni-halle.de).

## Content

1. [Features](#feature)
2. [Setup](#setup)
3. [Usage](#usage)
4. [Environments](#environments)
5. [How it works](#how-it-works)
6. [BPMN examples](#bpmn-examples)
7. Transform / Output
8. [Options](#options)
9. [ToDo](#todo)
9. [License](#license)

## Features

- Connecting to Camunda External Task queue to process service tasks
- Create a new Acrobat form by filling in data into an existing form
- Transform the form (e.g. print barcode on)
- Output the form (e.g. as File process variable, upload to nextcloud etc.)

## Setup

1. Clone the repository 

    `git clone`

2. Install npm dependencies
    `npm install`

3. Rename `app.json.example` to `app.json`

4. Configure options in `app.json`

5. Run
    1. With nodejs `npm start`
    2. With PM2 `pm2 start app.json`
    
**Requirements:**
- No JAVA
- NodeJS >= 8.12.0 `tested and developed with, newer should work`
- Camunda >= 8.9 `prior 8.9 will not support async response`
- pdftk
    - Windows: Download pdftk and copy `pdftk.exe` and `libiconv2.dll` into the
    root directory of this project.
    - Linux: Look up the package needed by your distribution

## Usage

### Mock server

- Currently on todo list

### BPMN

1. Set up the project and configure a Camunda instance (BASE_URL)
2. Set the environment variable for topic subscription (TOPIC)
3. Set the external task topic in your BPMN 
4. Deploy your BPMN (... try one of the examples)
5. Start the app - `npm start`
6. Start the process through tasklist

You can use one of the examples to get started - [BPMN examples](#bpmn-examples)

## Environments

### Development

`NODE_ENV = "development"`
- Mock server is activated and can be used by a HTTP POST to localhost:45321
- Temporary files are not deleted (view all steps done)

### Staging

`NODE_ENV = "staging"`
- Mock server will not be activated
- Deletes all temporary files

### Production

`NODE_ENV = "production"`
- Mock server will not be activated
- Deletes all temporary files

## How it works

The service uses the JS version of Camunda External Task Client. The library is 
acquired through the support package "prodig-external-deps" which is a base package
to all my microservices I use in our project.

The External Task Client uses Camundas task queue to process external tasks and 
responds to them. For more information see Camunda docs at [GitHub Project](https://github.com/camunda/camunda-external-task-client-js)

This service is intended to be run by PM2 Node.js process manager. The app.json 
is prepared to be used for starting the service. For more information 
about PM2 see [PM2 Homepage](http://pm2.keymetrics.io/).

The service will fill in all process variables in a PDF form you specified in the process.
It then outputs in some way you want the file (e.g. as binary variable within Camunda).

Optional the service can transform the resulting pdf or/and outputs the final result somewhere/somehow.

For filling in variables pdftk is used by npm module `pdffiller`.
Pdffiller itself is a wrapper for [pdftk server](https://www.pdflabs.com/tools/pdftk-server/) which must be present on the system.

## BPMN examples

The project includes BPMN examples to use with the service.

You can refer to the BPMN and example config in the project which uses 
'prodig.test.external.pdffiller' as topic subscription by default.

**Fill example form**

File: fill_example_form.bpmn

Service task is used to fill in variables from User task into the example form.
Resulting PDF is then attached to the process as file variable.

**Fill example form with barcode**

File: fill_example_form_barcode.bpmn

Service task is used to fill in variables from User task into the example form.
Resulting temporary output is then transformed to include a barcode.

Resulting PDF is then attached to the process as file variable.

## Transform / Output

The idea of the transformation/output process is, that you can decide on BPMN level what to
do with temporary and final output of the form filler and in which order to execute that.

The current project setup allows to integrate more transformations and outputs by using modules
in the corresponding folders.

### transform

A transformation module needs to exist in the `transform` folder.
It can than be called from BPMN by setting the input variable `transform` on the service task.

A transformation is done after the pdffiller and before the output.

More than one transformation can be separated with comma and is executed in order.

The transformation module has two inputs variables:
- tempFile - The temporary input file from pdffiller
- variablesIn - An object of all process variables

The module returns a promise which resolves to a new path of the transformed file.

### output

An output module needs to exist on the `output` folder.

It can than be called from BPMN by setting the input variable `output` on the service task.

An output is done after the pdffiller and after transformation.

The output module has three input variables
- outputFile - final file path to output somewhere, somehow
- variablesIn - An object of all process variables
- processVariables - An instance of Camunda External Task Variable 

The module returns a promise.

## Options

All application settings are set through [PM2 process file](http://pm2.keymetrics.io/docs/usage/application-declaration/) 
format. You can find an example in app.json.example.

Settings are read from app.json.

Settings are string values (e. g. "true" for bool) and will be parsed if necessary.

| ENV | Type | Default | Required | Description |
| --- | ---- | --- | --- | --- |
| NODE_ENV | development / staging / production | - | X | NodeJS execution environment |
| MAX_TASK | {Number} | 10 | | See [Camunda docs](https://github.com/camunda/camunda-external-task-client-js/blob/master/docs/Client.md#new-clientoptions) |
| INTERVAL | {Number} | 300 | | See [Camunda docs](https://github.com/camunda/camunda-external-task-client-js/blob/master/docs/Client.md#new-clientoptions) |
| ASYNC_RESPONSE_TIMEOUT | {Number} | - | | See [Camunda docs](https://github.com/camunda/camunda-external-task-client-js/blob/master/docs/Client.md#new-clientoptions) |
| LOCK_DURATION | {Number} | 50000 | | See [Camunda docs](https://github.com/camunda/camunda-external-task-client-js/blob/master/docs/Client.md#new-clientoptions) |
| BASE_URL | {String} | - | | See [Camunda docs](https://github.com/camunda/camunda-external-task-client-js/blob/master/docs/Client.md#new-clientoptions) |
| AUTH | {Boolean} | false | | Activate basic auth for Camunda Rest API |
| USER | {String} | - | If AUTH == true | Basic auth user |
| PASS | {String} | - | If AUTH == true | Basic auth password |
| TOPIC | {String} | - | | Camunda External Task topic |
| LOG_CAMUNDA | {Boolean} | - | | Use Camunda External Client log |
| LOG_FILE | {Boolean} | - | | Use bunyan file/console log |

## ToDo

- Mock server (for testing on the fly)
- Tests

## License

MIT

## Credits

Kai Raschke