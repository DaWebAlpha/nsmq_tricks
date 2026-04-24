import { AppError } from "./app.error.js";

class TooManyRequestsError extends AppError {
    constructor({message = "Too many requests, please try again later", details = null}) {
        super(message, 429, false, details);
        this.name = "TooManyRequestsError";
    }
}

export { TooManyRequestsError };
export default TooManyRequestsError;
