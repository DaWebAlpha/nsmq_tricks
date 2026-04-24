import { AppError } from "./app.error.js";

class UnauthorizedError extends AppError{
    constructor({message = "Forbidden", details = "You are not authorized"} = {}){
        super(message, 403, false, details);
    }
}


export { UnauthorizedError };
export default UnauthorizedError;


/*
const err = new UnauthorizedError({});
console.error(err);
UnauthorizedError: Forbidden
    at file:///C:/Users/USER/Desktop/projects/nsmq_tricks/backend/src/errors/unauthorized.error.js:
9:13
    at ModuleJob.run (node:internal/modules/esm/module_job:343:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:647:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:117:5) {
  success: false,
  statusCode: 403,
  details: 'You are not authorized',
  isOperational: true
}
*/