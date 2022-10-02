let board = [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ']
const buttonPress = async (btnValue) => {
    //Logic here will disable the buttons noot used
    const data = {
        grid: board,
        move: btnValue
    }
    const answer = await fetch(`${window.location.origin}/ttt/play`, {
        method: 'POST', // or 'PUT'
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    })
    const responseText = await answer.json();
    const newGrid = responseText.grid;
    board = newGrid;
    updateBoard();
    if (responseText.winner != ' ') {
        stopPlay();
    }
}


const updateBoard = () => {
    for (let i = 0; i < 9; i++) {
        const gettingBtn = document.getElementById(`btn${i + 1}`);
        if (board[i] != ' ') {
            gettingBtn.disabled = true;
            gettingBtn.innerHTML = board[i];
        }
    }
}

const stopPlay = () => {
    for (let i = 0; i < 9; i++) {
        const gettingBtn = document.getElementById(`btn${i + 1}`);
        if (gettingBtn.disabled == false) {
            gettingBtn.disabled = true;
        }
    }
}


function getParameters() {

    let urlString = window.location.href;
    let paramString = urlString.split('?')[1];
    let queryString = new URLSearchParams(paramString);
    for (let [key, value] of queryString.entries()) {
        if (key === 'name') {
            document.getElementById('user_not_logged').style.display = 'none';
            document.getElementById('user_logged').style.display = 'inline';
            document.getElementById('intro').innerHTML =
                "<h1> Hello " + value + ", " + new Date() + " </h1>";
        }
    }
}