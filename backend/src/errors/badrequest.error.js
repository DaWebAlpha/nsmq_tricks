import { AppError } from "./app.error.js";

class BadRequestError extends AppError{
    constructor({message = "Bad Request Error", details = null} = {}){
        super(message, 400, false, details);
    }
}

export { BadRequestError };
export default BadRequestError;




/* 
const err = new BadRequestError({
    message: "Bad Request Error",
    details: "Error",  
})
console.error(err);

node ./backend/src/errors/badrequest.error.js
BadRequestError: Bad Request Error
    at file:///C:/Users/USER/Desktop/projects/nsmq_tricks/backend/src/errors/badrequest.error.js:9:
13
    at ModuleJob.run (node:internal/modules/esm/module_job:343:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:647:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:117:5) {
  success: false,
  statusCode: 400,
  details: 'Error',
  isOperational: true
}
*/