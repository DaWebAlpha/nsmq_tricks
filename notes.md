# nsmq_tricks


## CREATE REPOSITORY

```javascript

    gh repo create
    
```


## CREATE BACKEND AND FRONTEND
```javascript
    mkdir backend && mkdir backend && cd backend
```

## CREATE PACKAGE.JSON
 ```javascript
    npm init -y

    change package.json to


    {
  "name": "nsmq_tricks",
  "version": "1.0.0",
  "description": "NSMQ",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "start": "node ./backend/src/server.js",
    "dev": "nodemon ./backend/src/server.js"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/DaWebAlpha/nsmq_tricks.git"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "module",
  "bugs": {
    "url": "https://github.com/DaWebAlpha/nsmq_tricks/issues"
  },
  "homepage": "https://github.com/DaWebAlpha/nsmq_tricks#readme"
}
 ```



## INSTALL THESE

```javascript
    npm install express mongoose dotenv pino pino-roll
    npm install --save-dev nodemon jest supertest pino-pretty
```


## CREATE APPERROR IN ./backend/src/error/app.error.js

```javascript
    class AppError extends Error{
    constructor(message = "Application Error", statusCode = 500, details = null){
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.details = details;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
        
    }
}

export { AppError };
export default AppError;
```


## TEST APPERROR

```javascript
const err = new AppError("Internal Server Error", 500, "Server could not start");
console.error(err);


RESULT
node ./src/errors/app.error.js
AppError: Internal server error
    at file:///C:/Users/USER/Desktop/projects/nsmq_tricks/backend/src/errors/app.error.js:14:13
    at ModuleJob.run (node:internal/modules/esm/module_job:343:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:647:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:117:5) {
  statusCode: 500,
  details: 'Server could not start',
  isOperational: true
}
```

## CREATE InternalServerError IN ./backend/src/error/internalserver.error.js

```javascript
import { AppError } from "./app.error.js";


class InternalServerError extends AppError{
    constructor({message =  "Internal server error", details = null} = {}){
        super(message, 500, details);
    }   
}


export { InternalServerError };
export default InternalServerError;
```

## TEST WITH THIS

```javascript
    const err = new InternalServerError({message: "Internal Server Error", statusCode: 500});
    console.error(err);

    RESULT

    node ./src/errors/internalserver.error.js
    InternalServerError: Internal Server Error
        at file:///C:/Users/USER/Desktop/projects/nsmq_tricks/backend/src/errors/internalserver.error
    .js:10:13
        at ModuleJob.run (node:internal/modules/esm/module_job:343:25)
        at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:647:26)
        at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:117:5) {
      statusCode: 500,
      details: null,
      isOperational: true
    }

```


## BADREQUEST ERROR

```javascript
import { AppError } from "./app.error.js";

class BadRequestError extends AppError{
    constructor({message = "Bad Request Error", details = null}){
        super(message, 400, details);
    }
}



export { BadRequestError };
export default BadRequestError;
```

## TEST WITH THIS 

```javascript
const err = new BadRequestError({message: "Bad Request error", statusCode: 400});
console.error(err);

node ./src/errors/badrequest.error.js
BadRequestError: Bad Request error
    at file:///C:/Users/USER/Desktop/projects/nsmq_tricks/backend/src/errors/badrequest.error.js:
10:13
    at ModuleJob.run (node:internal/modules/esm/module_job:343:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:647:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:117:5) {
  statusCode: 400,
  details: null,
  isOperational: true
}

```


## NOTFOUND.ERROR.JS
```javascript
import { AppError } from "./app.error.js";


class NotFoundError extends AppError{
    constructor({message = "Resource Not Found", details = null}){
        super(message, 404, details);
    }
}


const err = new NotFoundError({message: "Resource Not Found", statusCode: 404});
console.error(err);

export { NotFoundError };
export default NotFoundError;

```

## TESTING WITH CONSOLE.LOG RESULTS

```javascript
node ./src/errors/notfound.error.js
NotFoundError: Resource Not Found
    at file:///C:/Users/USER/Desktop/projec
ts/nsmq_tricks/backend/src/errors/notfound.
error.js:11:13
    at ModuleJob.run (node:internal/modules
/esm/module_job:343:25)
    at async onImport.tracePromise.__proto_
_ (node:internal/modules/esm/loader:647:26)
    at async asyncRunEntryPointWithESMLoade
r (node:internal/modules/run_main:117:5) {
  statusCode: 404,
  details: null,
  isOperational: true
}

```


## CONFLICT ERROR

```javascript
import { AppError } from "./app.error.js";


class ConflictError extends AppError{
    constructor({message = "Conflict Error", details = "Resource already exists"} = {}){
        super(message, 409, details)
    }
}


export { ConflictError };
export default ConflictError;
```

## RESULT
```javascript
node ./src/errors/conflict.error.js
ConflictError: Conflict Error
    at file:///C:/Users/USER/Desktop/projects/nsmq_tricks/backend/src/errors/conflict.error.js:10
:13
    at ModuleJob.run (node:internal/modules/esm/module_job:343:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:647:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:117:5) {
  statusCode: 409,
  details: 'Resource already exists',
  isOperational: true
}

```


## UNAUTHORIZED ACCESS
```javascript
import { AppError } from "./app.error.js";

class UnauthorizedError extends AppError{
    constructor({message = "Unauthorized", details = "You are not authorized"} = {}){
        super(message, 401, details);
    }
}


const err = new UnauthorizedError({});
console.error(err);

export { UnauthorizedError };
export default UnauthorizedError;
```

## RESULT 

```javascript
ode ./src/errors/unauthorized.error.js
UnauthorizedError: Unauthorized
    at file:///C:/Users/USER/Desktop/projects/nsmq_tricks/backend/src/errors/unauthorized.error.j
s:10:13
    at ModuleJob.run (node:internal/modules/esm/module_job:343:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:647:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:117:5) {
  statusCode: 401,
  details: 'You are not authorized',
  isOperational: true
}
```