import { AppError } from "./app.error.js";

class UnauthenticatedError extends AppError{
    constructor({message = "Authentication required", details = null} = {}){
        super(message, 401, false, details);
    }
}


export { UnauthenticatedError };
export default UnauthenticatedError;

/*
const err = new UnauthenticatedError({});
console.error(err);

UnauthenticatedError: Authentication required
    at file:///C:/Users/USER/Desktop/projects/nsmq_tricks/backend/src/errors/unauthenticated.error.
js:10:13
    at ModuleJob.run (node:internal/modules/esm/module_job:343:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:647:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:117:5) {
  success: false,
  statusCode: 401,
  details: null,
  isOperational: true
}
*/