const express = require('express');
const app = express();
const ejsEngine = require('ejs-mate');
const cookieParser = require('cookie-parser');
const path = require('path');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
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

app.get('/ttt', (req, res) => {
    const { username } = req.cookies;
    let newDate = Date();
    if (username) { //Render different based off cookie data
        res.render('tictac', { name: username, date: newDate });
    } else {
        res.render('check');
    }


})

app.post('/login', async (req, res) => {
    const options = {
        maxAge: 1000 * 60 * 15, //Third value can be changed to manipulate amount of minutes, in this ex. it's 15 min
        httpOnly: true
    }
    if (!req.body.username || !req.body.password) { //Checking if login doesnt have username or password
        res.sendStatus(400);
    } else {
        //Here we will check our database!
        const getUser = await User.findOne({ username: req.body.username, password: req.body.password });//Tries to find a user with that exact info and if it works then send them to play
        if (getUser) {
            res.cookie('username', req.body.username, options);
            res.cookie('password', req.body.password, options);
            res.redirect('/ttt');
        } else {
            res.sendStatus(400)
        }
    }
})

app.post('/logout', (req, res) => {
    if (req.cookies) {
        if (req.cookies.username && req.cookies.password) { //Checking if there exists cookies for username and password
            res.clearCookie('username'); //Clearng our cookies
            res.clearCookie('password');
            res.redirect('/ttt');
        } else {
            res.redirect('/ttt');
        }
    } else {
        res.sendStatus(401); //Unauthorized status code
        res.redirect('/ttt');
    }
})

app.get('/verify', async (req, res) => {
    const { email, key } = req.query;
    if (email && key) {
        if (key === '') {
            const foundEmail = await User.findOne({ 'email': email }); //Finding our email
            if (foundEmail && foundEmail.isVerified == false) {
                await User.findOneAndUpdate({ 'email': email }, { isVerified: true }, { new: true }); //This finds the user based off email and updates!
                res.sendStatus(200);
            } else {
                //Email not in the system! Or is already verified
                res.sendStatus(400);
            }
        } else {
            res.sendStatus(400);//If key doesnt match send a 400
        }
    } else {
        res.sendStatus(400) //if the query string doesnt have key or email send 400
        
        // send a verification to address that contains both
        // email and key.
        
        const transport = nodemailer.createTransport({
            service: 'smtp',
            auth: {
                user: 'ouremail@gmail.com',
                pass: 'password'
            }
        });

        var mailOps = {
            from: 'ouremail@gmail.com',
            to: email,
            subject: 'verification link',
        text: `${window.location.origin}/verify` + "?email=" + email + "&key=" + key
        }

        transport.sendMail(mailOps, function(err, info) {
            if (err) {
                res.sendStatus(400);
            }
            else {
                res.sendStatus(200);
            }
        });
    }
})

app.post('/adduser', async (req, res) => {
    if (!req.body.username || !req.body.password || !req.body.email) {
        res.sendStatus(400) //Bad request if it doesnt have username, password or email
    } else {
        const alreadyCreated = await User.findOne({ 'username': req.body.username });
        if (alreadyCreated) {
            //Throw error if user is created
            res.sendStatus(400);
        } else {
            const newUser = new User({ //This will create the user we need
                username: req.body.username,
                password: req.body.password,
                email: req.body.email,
                isVerified: false,
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
            res.redirect('/verify');
            res.sendStatus(200);
        }
    }
})

app.post('/ttt/play', async (req, res) => {
    let grid = req.body.grid;
    let move = req.body.move;
    const { username, password } = req.cookies;
    if (!username || !password) {
        return res.sendStatus(404) //Stops the game early if u try playing without cookeis
    }
    const getUser = await User.findOne({ username: username, password: password });
    if (!getUser) {
        return res.sendStatus(404);//If user doesnt exit currently and u trynna play it is bad!
    }
    //THIS ONE MIGHT BE OUT OF ORDER IDK WHEN TO START!
    let newBoard = true;
    console.log(grid);
    console.log(move);
    for (let value of grid) {
        if (value !== ' ') {
            newBoard = false; //Doing a check if the grid is all empty to set up the new time date
        }
    }
    let currentGame;
    if (newBoard) {
        //If we are starting a new board we will create a game
        //Feel like we need a check for if a new board is sent to NOT make a new game dunno tho!
        currentGame = new Game({ id: getUser.gameData.currentGame, startDate: Date.now(), grid: grid, winner: ' ' })
        getUser.gameData.allGames.push(currentGame);
        getUser.save()
        currentGame.save();
    } else {

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
        return res.sendStatus(404); //If they try making a move into the grid that has a square filled is bad!! or if they try filing it with a non x move
    }
    grid[move] = 'X';
    let winner = checkWinner(grid);
    if (winner == 'T') {
        const data = {
            grid: grid,
            winner: 'T'
        }
        res.json(data);
    } else if (winner == 'X') {
        const data = {
            grid: grid,
            winner: 'X'
        }
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
            res.json(data);
        } else if (winner == 'O') {
            const data = {
                grid: grid,
                winner: 'O'
            }
            res.json(data);
        } else {
            const data = {
                grid: grid,
                winner: ' '
            }
            res.json(data);
        }
    }
})

//list games of current user
app.post('/listgames', async (req, res) => {
    if (req.cookies) {
        User.findOne({ 'username': req.cookies.username }, (error, currentUser) => {
            if (error) {
                const data = {
                    status: 'ERROR',
                    games: null
                }
                res.json(data);
            } else {
                let gameHistory = currentUser.gameData.allGames;
                const data = {
                    status: 'OK',
                    games: gameHistory
                }
                res.json(data)
            }
        });
    } else {
        res.sendStatus(403)
        res.redirect('/login')
    }
});

//get games by given id of current user
app.post('/getgame', async (req, res) => {
    if (req.cookies) {
        User.findOne({ 'username': req.cookies.username }, (error, currentUser) => {
            if (error) { //if user is not found
                const data = {
                    status: 'ERROR',
                    game: null
                }
                res.json(data);
            } else { //if user is found then get their gameData, get allGames array and search for the specific game by given ID 
                let gameHistory = currentUser.gameData.allGames;
                let foundGame = gameHistory.find(game => game.id === req.body.id)
                if (foundGame) {
                    const data = {
                        status: 'OK',
                        game: foundGame
                    }
                    res.json(data)
                } else {
                    const data = {
                        status: 'ERROR',
                        game: null
                    }
                    res.json(data);
                }
            }
        });
    } else {
        res.sendStatus(403)
        res.redirect('/login')
    }
});

//get score overall of current user
app.post('/getscore', async (req, res) => {
    if (req.cookies) {
        User.findOne({ 'username': req.cookies.username }, (error, currentUser) => {
            if (error) {
                const data = {
                    status: 'ERROR',
                    games: null
                }
                res.json(data);
            } else {
                let gameHistory = currentUser.gameData.allGames;
                const data = {
                    status: 'OK',
                    human: gameHistory.win,
                    wopr: gameHistory.loss,
                    tie: gameHistory.tie
                }
                res.json(data)
            }
        });
    } else {
        res.sendStatus(403)
        res.redirect('/login')
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