class AppError extends Error{
    constructor(message = "Application Error", statusCode = 500, success = false, details = null){
        super(message);
        this.name = this.constructor.name;
        this.success = success;
        this.statusCode = statusCode;
        this.details = details;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);        
    }
}


export { AppError };
export default AppError;






/*
const err = new AppError({
    message: "Application Error",
    statusCode: 500,
    success: false,
    details: "Error"
})
console.error(err);

AppError: Application Error
    at file:///C:/Users/USER/Desktop/projects/nsmq_tricks/backend/src/errors/app.error.js:14:13
    at ModuleJob.run (node:internal/modules/esm/module_job:343:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:647:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:117:5) {
  success: false,
  statusCode: 500,
  details: 'Error',
  isOperational: true
}

*/