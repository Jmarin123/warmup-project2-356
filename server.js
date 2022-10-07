const express = require('express');
const app = express();
const ejsEngine = require('ejs-mate');
const cookieParser = require('cookie-parser');
const path = require('path');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const Game = require('./models/games.js');
const User = require('./models/user.js');
app.use(cookieParser());
app.use(express.json())
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.engine('ejs', ejsEngine);
app.set('views', path.join(__dirname, 'views')); //How to get the views directory.
app.use(express.static(path.join(__dirname, 'public')));


mongoose.connect('mongodb://localhost:27017/proj2');

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error: "));
db.once("open", function () {
    console.log("Connected successfully");
});

/*
Routes in order
use (for setting header everytime)
get /ttt (checking cookies)
post /login (self explanatory)
post /logout (also self explanatory)
get /verify (this is the link you need to send so users get verified, special key is "lX4%d3T297%C$!QZ")
post /adduser (adds a unverified user, this route needs to also send the email)
post /tt/play (assuming everything is good time to play)
Todo:
post /listgames
post /getgame { id }
post /getscore { }

*/


app.use((req, res, next) => {
    res.setHeader('X-CSE356', '6306e95158d8bb3ef7f6c4c7'); //Setting our header no matter request
    next();
})

app.get('/ttt', async (req, res) => {
    const { username, password } = req.cookies;
    let newDate = Date();
    if (username) { //Render different based off cookie data
        const getUser = await User.findOne({ username: username, password: password });
        if (getUser) {
            res.render('tictac', { name: username, date: newDate });
        } else {
            res.render('check');
        }
    } else {
        res.render('check');
    }


})

app.post('/login', async (req, res) => {
    const options = {
        maxAge: 1000 * 60 * 15, //Third value can be changed to manipulate amount of minutes, in this ex. it's 15 min
    }
    if (!req.body.username || !req.body.password) { //Checking if login doesnt have username or password
        res.json({ status: 'ERROR' });
    } else {
        //Here we will check our database!
        const getUser = await User.findOne({ username: req.body.username, password: req.body.password });//Tries to find a user with that exact info and if it works then send them to play
        if (getUser) {
            if (getUser.isVerified == false) {
                return res.json({ status: 'ERROR' });
            }
            res.cookie('username', req.body.username, options);
            res.cookie('password', req.body.password, options);
            res.json({ status: 'OK' });
        } else {
            res.json({ status: 'ERROR' });
        }
    }
})

app.post('/logout', (req, res) => {
    if (req.cookies) {
        if (req.cookies.username && req.cookies.password) { //Checking if there exists cookies for username and password
            res.clearCookie('username'); //Clearng our cookies
            res.clearCookie('password');
            res.json({ status: 'OK' })
        } else {
            res.json({ status: 'ERROR' });
        }
    } else {
        res.json({ status: 'ERROR' });; //Unauthorized status code
    }
})

app.get('/verify', async (req, res) => {
    const { email, key } = req.query;
    key = encodeURIComponent(key);
    email = encodeURIComponent(email);
    if (email && key) {
        const foundEmail = await User.findOne({ 'email': email });
        if (key === foundEmail.key) {
            //Finding our email
            if (foundEmail && foundEmail.isVerified == false) {
                await User.findOneAndUpdate({ 'email': email }, { isVerified: true }, { new: true }); //This finds the user based off email and updates!
                res.json({ status: 'OK' });
            } else {
                //Email not in the system! Or is already verified
                res.json({ status: 'ERROR' });
            }
        } else {
            res.json({ status: 'ERROR' });//If key doesnt match send a 400
        }
    } else {
        //if the query string doesnt have key or email send 400

        // send a verification to address that contains both
        // email and key.

        res.json({ status: 'ERROR' });
    }
})

app.post('/adduser', async (req, res) => {
    if (!req.body.username || !req.body.password || !req.body.email) {
        res.json({ status: 'ERROR' }) //Bad request if it doesnt have username, password or email
    } else {
        const alreadyCreated = await User.findOne({ 'username': req.body.username });
        if (alreadyCreated) {
            //Throw error if user is created
            res.json({ status: 'ERROR' });
        } else {
            const givenUUID = uuidv4();
            const newUser = new User({ //This will create the user we need
                username: req.body.username,
                password: req.body.password,
                email: encodeURIComponent(req.body.email),
                isVerified: false,
                key: encodeURIComponent(givenUUID),
                gameData: {
                    win: 0,
                    loss: 0,
                    tie: 0,
                    currentGame: 0,
                    allGames: []
                }
            });
            await newUser.save(); //Saves to database
            //Todo: send an email request to verify!    
            //res.redirect('/verify');



            const transport = nodemailer.createTransport({
                sendmail: true,
                newline: 'unix',
                path: '/usr/sbin/sendmail'
            });

            var mailOps = {
                from: 'goofy <root@goofy-goobers.cse356.compas.cs.stonybrook.edu>',
                to: encodeURIComponent(req.body.email),
                subject: 'verification link',
                text: `http://goofy-goobers.cse356.compas.cs.stonybrook.edu/verify` + "?email=" + encodeURIComponent(req.body.email) + "&key=" + encodeURIComponent(givenUUID)
            }

            transport.sendMail(mailOps, function (err, info) {
                if (err) {
                    res.json({ status: 'ERROR' });
                }
                else {
                    res.json({ status: 'OK' })
                }
            });
            //res.json({ status: 'OK' });
        }
    }
})

app.post('/ttt/play', async (req, res) => {
    let grid = req.body.grid;
    let move = req.body.move;
    const { username, password } = req.cookies;
    if (!username || !password) {
        return res.json({ status: 'ERROR' });//Stops the game early if u try playing without cookeis
    }
    const getUser = await User.findOne({ username: username, password: password });
    if (!getUser) {
        return res.json({ status: 'ERROR' });;//If user doesnt exit currently and u trynna play it is bad!
    }
    //THIS ONE MIGHT BE OUT OF ORDER IDK WHEN TO START!
    let newBoard = true;
    for (let value of grid) {
        if (value !== ' ') {
            newBoard = false; //Doing a check if the grid is all empty to set up the new time date
        }
    }
    let currentGame;
    let indexOfGame = getUser.gameData.currentGame;
    if (newBoard) {
        //If we are starting a new board we will create a game
        //Feel like we need a check for if a new board is sent to NOT make a new game dunno tho!
        currentGame = new Game({ id: indexOfGame, startDate: Date.now(), grid: grid, winner: ' ' })
        getUser.gameData.allGames.push(currentGame);
        getUser.save()
        currentGame.save();
    } else {
        let getGameID = getUser.gameData.allGames[indexOfGame]._id;
        currentGame = await Game.findOne({ _id: getGameID });
    }
    //Todo this all so it updates in the mongo client ;P
    if (move == null) {
        const data = {
            grid: grid,
            winner: ' '
        }
        return res.json(data);
    }
    if (grid[move] !== ' ') {
        return res.json({ status: 'ERROR' }); //If they try making a move into the grid that has a square filled is bad!! or if they try filing it with a non x move
    }
    grid[move] = 'X';
    let winner = checkWinner(grid);
    if (winner == 'T') {
        const data = {
            grid: grid,
            winner: 'T'
        }
        await currentGame.updateOne({ grid: grid });
        await currentGame.updateOne({ winner: 'T' });
        await getUser.updateOne({
            gameData: {
                win: getUser.gameData.win,
                loss: getUser.gameData.loss,
                tie: (getUser.gameData.tie + 1),
                currentGame: (getUser.gameData.currentGame + 1),
                allGames: getUser.gameData.allGames
            }
        })
        res.json(data);
    } else if (winner == 'X') {
        const data = {
            grid: grid,
            winner: 'X'
        }
        await currentGame.updateOne({ grid: grid });
        await currentGame.updateOne({ winner: 'X' });
        await getUser.updateOne({
            gameData: {
                win: (getUser.gameData.win + 1),
                loss: getUser.gameData.loss,
                tie: getUser.gameData.tie,
                currentGame: (getUser.gameData.currentGame + 1),
                allGames: getUser.gameData.allGames
            }
        })
        res.json(data);
    } else {
        while (true) {
            let randomInt = Math.floor(Math.random() * 9);
            if (grid[randomInt] == ' ') {
                grid[randomInt] = 'O';
                break;
            }
        }
        winner = checkWinner(grid);
        if (winner == 'T') {
            const data = {
                grid: grid,
                winner: 'T'
            }
            await currentGame.updateOne({ grid: grid });
            await currentGame.updateOne({ winner: 'T' });
            await getUser.updateOne({
                gameData: {
                    win: getUser.gameData.win,
                    loss: getUser.gameData.loss,
                    tie: (getUser.gameData.tie + 1),
                    currentGame: (getUser.gameData.currentGame + 1),
                    allGames: getUser.gameData.allGames
                }
            })
            res.json(data);
        } else if (winner == 'O') {
            const data = {
                grid: grid,
                winner: 'O'
            }
            await currentGame.updateOne({ grid: grid });
            await currentGame.updateOne({ winner: 'O' });
            await getUser.updateOne({
                gameData: {
                    win: getUser.gameData.win,
                    loss: (getUser.gameData.loss + 1),
                    tie: getUser.gameData.tie,
                    currentGame: (getUser.gameData.currentGame + 1),
                    allGames: getUser.gameData.allGames
                }
            })
            res.json(data);
        } else {
            const data = {
                grid: grid,
                winner: ' '
            }
            await currentGame.updateOne({ grid: grid });
            res.json(data);
        }
    }
})

//list games of current user
app.post('/listgames', async (req, res) => {
    if (req.cookies && req.cookies.username && req.cookies.password) {
        // User.findOne({ 'username': req.cookies.username }, (error, currentUser) => {
        //     if (error) {
        //         const data = {
        //             status: 'ERROR',
        //             games: null
        //         }
        //         res.json(data);
        //     } else {
        //         let gameHistory = currentUser.gameData.allGames;
        //         const data = {
        //             status: 'OK',
        //             games: gameHistory
        //         }
        //         res.json(data)
        //     }
        // });
        const getUser = await User.findOne({ username: req.cookies.username, password: req.cookies.password });
        if (getUser) {
            let gameArray = [];
            for (const game of getUser.gameData.allGames) {
                let getGameID = game._id;
                let currentGame = await Game.findOne({ _id: getGameID });
                gameArray.push({ id: currentGame.id, start_date: currentGame.startDate })
            }
            res.json({ status: 'OK', games: gameArray });
        } else {
            res.json({ status: 'ERROR' })
        }
    } else {
        res.json({ status: 'ERROR' });
        //res.redirect('/login')
    }
});

//get games by given id of current user
app.post('/getgame', async (req, res) => {
    if (req.cookies && req.cookies.username && req.cookies.password) {
        // User.findOne({ 'username': req.cookies.username }, (error, currentUser) => {
        //     if (error) { //if user is not found
        //         const data = {
        //             status: 'ERROR',
        //             game: null
        //         }
        //         res.json(data);
        //     } else { //if user is found then get their gameData, get allGames array and search for the specific game by given ID 
        //         let gameHistory = currentUser.gameData.allGames;
        //         let foundGame = gameHistory.find(game => game.id === req.body.id)
        //         if (foundGame) {
        //             const data = {
        //                 status: 'OK',
        //                 game: foundGame
        //             }
        //             res.json(data)
        //         } else {
        //             const data = {
        //                 status: 'ERROR',
        //                 game: null
        //             }
        //             res.json(data);
        //         }
        //     }
        // });
        const getUser = await User.findOne({ username: req.cookies.username, password: req.cookies.password });
        if (getUser && req.body.id) {
            if (getUser.gameData.allGames.length > req.body.id && req.body.id >= 0) {
                let getGameID = getUser.gameData.allGames[req.body.id]._id;
                let currentGame = await Game.findOne({ _id: getGameID });
                res.json({ status: 'OK', grid: currentGame.grid, winner: currentGame.winner });

            } else {
                res.json({ status: 'ERROR' })
            }
        } else {
            res.json({ status: 'ERROR' })
        }
    } else {
        res.json({ status: 'ERROR' });
        //res.redirect('/login')
    }
});

//get score overall of current user
app.post('/getscore', async (req, res) => {
    if (req.cookies && req.cookies.username && req.cookies.password) {
        // User.findOne({ 'username': req.cookies.username }, (error, currentUser) => {
        //     if (error) {
        //         const data = {
        //             status: 'ERROR',
        //         }
        //         res.json(data);
        //     } else {
        //         let gameHistory = currentUser.gameData.allGames;
        //         const data = {
        //             status: 'OK',
        //             human: gameHistory.win,
        //             wopr: gameHistory.loss,
        //             tie: gameHistory.tie
        //         }
        //         res.json(data)
        //     }
        // });
        const getUser = await User.findOne({ username: req.cookies.username, password: req.cookies.password });
        if (getUser) {
            res.json({ status: 'OK', human: getUser.gameData.win, wopr: getUser.gameData.loss, tie: getUser.gameData.tie })
        } else {
            res.json({ status: 'ERROR' });
        }
    } else {
        res.json({ status: 'ERROR' });
        //res.redirect('/login')
    }
});


const checkWinner = (tictactoe) => {
    if (tictactoe[0] == tictactoe[1] && tictactoe[0] == tictactoe[2] && tictactoe[0] != ' ') { //0,1,2-H
        return tictactoe[0];

    } else if (tictactoe[3] == tictactoe[4] && tictactoe[3] == tictactoe[5] && tictactoe[3] != ' ') { //3,4,5-H
        return tictactoe[3];

    } else if (tictactoe[6] == tictactoe[7] && tictactoe[6] == tictactoe[8] && tictactoe[6] != ' ') { //6,7,8-H
        return tictactoe[6];

    } else if (tictactoe[0] == tictactoe[3] && tictactoe[0] == tictactoe[6] && tictactoe[0] != ' ') { //0,3,6-V
        return tictactoe[0];

    } else if (tictactoe[1] == tictactoe[4] && tictactoe[1] == tictactoe[7] && tictactoe[1] != ' ') { //1,4,7-V
        return tictactoe[1];

    } else if (tictactoe[2] == tictactoe[5] && tictactoe[2] == tictactoe[8] && tictactoe[2] != ' ') { //2,5,8-V
        return winner = tictactoe[2];

    } else if (tictactoe[0] == tictactoe[4] && tictactoe[0] == tictactoe[8] && tictactoe[0] != ' ') { //0,4,8-D
        return tictactoe[0];

    } else if (tictactoe[2] == tictactoe[4] && tictactoe[2] == tictactoe[6] && tictactoe[2] != ' ') { //2,4,6-D
        return tictactoe[2];
    }

    let isFull = true;
    for (const slot of tictactoe) {
        if (slot == ' ') {
            isFull = false;
        }
    }

    if (isFull) {
        return 'T'; //there is a tie
    } else {
        return ' '; //the board is not full, so play continues
    }
}

app.listen(80, () => {
    console.log("Listening on port 80!");
})