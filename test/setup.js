// options for typescript (
process.env['TS_NODE_TRANSPILE_ONLY'] = 'true';
process.env['TS_NODE_COMPILER_OPTIONS'] = '{"module":"commonjs", "noEmit": "false"}';
// polyfiles for AbortController
global.fetch = require('node-fetch');
require('abortcontroller-polyfill/dist/polyfill-patch-fetch');
// transpiling esm to commonjs
require('ts-node/register');
require('source-map-support/register');
// chai & sinon setup
const chai = require("chai");
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const chaiAsPromised = require("chai-as-promised");

chai.use(sinonChai);
chai.use(chaiAsPromised);

global.expect = chai.expect;
global.sinon = sinon;