---

# ⚙️ CONFIGURATION

## 📑 INDEX

* [SET UP PORT](#-set-up-port)

---

## 🔧 SET UP PORT

### PROJECT TREE FOR PORT

```bash
$ tree -I node_modules
.
|-- backend
|   |-- src
|   |   |-- app.js
|   |   |-- server.js
|   |   `-- config
|   |       `-- config.js
|-- package-lock.json
|-- package.json
|-- .env
`-- .gitignore
```

---

### 🗂️ CREATE MAIN FOLDER

Use `mkdir` to create the main project folder and navigate into it:

```bash
mkdir project && cd project
```

---

### 🗂️ CREATE BACKEND FOLDER

Create the backend directory and move into it:

```bash
mkdir backend && cd backend
```

---

### 🗂️ CREATE SRC FOLDER

Create the `src` directory:

```bash
mkdir src && cd src
```

---

### 📄 CREATE package.json

Move back to the root (`project`) and initialize a Node.js project:

```bash
cd ..
npm init -y
```

---

### ⚙️ UPDATE package.json

Modify your `package.json` to include the following:

* Start script for production
* Development script using Nodemon
* Enable ES Modules

```json
{
  "name": "bird",
  "version": "1.0.0",
  "description": "",
  "main": "./backend/src/server.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "start": "node ./backend/src/server.js",
    "dev": "nodemon ./backend/src/server.js"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "module",
  "dependencies": {
    "dotenv": "^17.4.2",
    "express": "^5.2.1",
    "mongoose": "^9.4.1"
  },
  "devDependencies": {
    "nodemon": "^3.1.14"
  }
}
```

---

### 📥 INSTALL DEPENDENCIES

Install required packages:

```bash
npm install express mongoose dotenv
npm install --save-dev nodemon
```

---

### 🌱 CREATE .env FILE

Create a `.env` file in the root directory:

```bash
PORT=5000
```

---

### 🔒 CREATE .gitignore

Prevent environment variables from being pushed to GitHub:

```bash
.env
```

---

### 🗂️ CREATE CONFIG FOLDER AND FILE

Navigate into `backend/src` and create the config folder and file:

```bash
cd backend/src
mkdir config && touch config/config.js
```

---

### 🗂️ WRITE INITIAL CODE IN config.js

```javascript
import dotenv from "dotenv";

dotenv.config();


const { PORT } = process.env;

const toPositiveInt = (value, fallback) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const config = Object.freeze({
    port: toPositiveInt(PORT, 5000),
});

export { config };
export default config;
```

---

### 🗂️ CREATE app.js

```bash
touch app.js
```

```javascript
import express from "express";

const app = express();

export { app };
export default app;
```

---

### 🗂️ CREATE server.js

```bash
touch server.js
```

```javascript
import { app } from "./app.js";
import { config } from "./config/config.js";

const PORT = config.port;

const startServer = async () => {
    try {
        const server = app.listen(PORT, () => {
            console.log(`Listening on PORT ${PORT}`);
        });

        server.on("error", (error) => {
            console.error("Server failed to start:", error);
            process.exit(1);
        });
    } catch (error) {
        console.error("Unexpected startup error:", error);
        process.exit(1);
    }
};

startServer();
```

---
