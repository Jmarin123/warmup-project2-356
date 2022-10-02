const mongoose = require('mongoose');
const Schema = mongoose.Schema;


const gameSchema = new Schema({
    id: Number,
    startDate: Date,
    grid: [String],
    winner: String
});

module.exports = mongoose.model('Game', gameSchema);