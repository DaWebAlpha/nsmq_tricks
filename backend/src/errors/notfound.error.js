import { AppError } from "./app.error.js";


class NotFoundError extends AppError{
    constructor({message = "Resource Not Found", details = null} = {}){
        super(message, 404, false, details);
    }
}

export { NotFoundError };
export default NotFoundError;


/*
const err = new NotFoundError({});
console.error(err);

NotFoundError: Resource Not Found
    at file:///C:/Users/USER/Desktop/projects/nsmq_tricks/backend/src/errors/notfound.error.js:10:13
    at ModuleJob.run (node:internal/modules/esm/module_job:343:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:647:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:117:5) {
  success: false,
  statusCode: 404,
  details: null,
  isOperational: true
}
*/
