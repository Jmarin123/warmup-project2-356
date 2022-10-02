const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    username: String,
    password: String,
    email: String,
    isVerified: Boolean,
    gameData: {
        win: Number,
        loss: Number,
        tie: Number,
        currentGame: Number,
        allGames: [
            {
                type: Schema.Types.ObjectId,
                ref: 'Game'
            }
        ]
    }
})

userSchema.virtual('getGameLength').get(function () {
    return this.gameData.allGames.length;
})


module.exports = mongoose.model('User', userSchema);