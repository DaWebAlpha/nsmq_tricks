import { AppError } from "./app.error.js";


class ConflictError extends AppError{
    constructor({message = "Conflict Error", details = "Resource already exists"} = {}){
        super(message, 409, false, details)
    }
}


export { ConflictError };
export default ConflictError;


/*
const err = new ConflictError({});
console.error(err);

ConflictError: Conflict Error
    at file:///C:/Users/USER/Desktop/projects/nsmq_tricks/backend/src/errors/conflict.error.js:11:13
    at ModuleJob.run (node:internal/modules/esm/module_job:343:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:647:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:117:5) {
  success: false,
  statusCode: 409,
  details: 'Resource already exists',
  isOperational: true
}
*/