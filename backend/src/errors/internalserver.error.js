import { AppError } from "./app.error.js";


class InternalServerError extends AppError{
    constructor({message =  "Internal Server Error", details = null} = {}){
        super(message, 500, false, details);
    }   
}


export { InternalServerError };
export default InternalServerError;



/*
const err = new InternalServerError({});
console.error(err);

InternalServerError: Internal Server Error
    at file:///C:/Users/USER/Desktop/projects/nsmq_tricks/backend/src/errors/internalserver.error.js:10:13
    at ModuleJob.run (node:internal/modules/esm/module_job:343:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:647:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:117:5) {
  success: false,
  statusCode: 500,
  details: null,
  isOperational: true
}

*/