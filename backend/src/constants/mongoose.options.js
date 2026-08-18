/**
 * Connection options passed to mongoose.connect(). `autoIndex` is
 * environment-dependent, so it stays computed in mongoose.database.js
 * rather than baked in here.
 */
const OPTIONS = Object.freeze({
    socketTimeoutMS: 45000,
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 50,
    minPoolSize: 5,
})

export {
    OPTIONS
}
