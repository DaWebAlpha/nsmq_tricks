import mongoose from "mongoose";
import { config } from "../config/config.js"
import { system_logger } from "./pino.logger.js";
import InternalServerError from "../errors/internalserver.error.js";


const MONGO_URI = config.mongo_uri;


const connectDB = async() => {

    if(!MONGO_URI){
        system_logger.error("MONGO_URI is not defined in environment variables");
        throw new InternalServerError({message: "MONGO_URI is not defined in environment variables"});
    }
    try{

        const options = {
            maxPoolSize: 50,
            minPoolSize: 5,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        }

        await mongoose.connect(MONGO_URI, options)
        system_logger.info("Database has been connected");

    }catch(error){
        system_logger.error("Failed to connect database",{error: error.message});

        throw new InternalServerError({message: "Failed to connect database", details: `${error.message}`})
    }
}

// Event listeners (safe after mock)
mongoose.connection.on("disconnected", () => {
  system_logger.warn("MongoDB connection lost");
});

mongoose.connection.on("error", (err) => {
  system_logger.error("MongoDB connection error", {
    error: err.message,
  });
});

export { connectDB };
export default connectDB;