# JavaScript PGN Reader

In this repository is a simple PGN reader written in JavaScript. It lets you easily read any PGNs and get the position after every single move.

# Table of Contents

- About
- Installation
- API Usage
- Outputting Chess Board to HTML
- Extra Notes
- License

## About

[PGN](https://en.wikipedia.org/wiki/Portable_Game_Notation) files are special files which carry chess games. Reading these PGNs can be a hassle and take time to develop, since you have to consider: legal moves in the current position, which piece to move, if the move given is even legal, if the syntax for the notation is correct, and so on and so forth. Parsing generally, will become difficult as there is a lot to check and process.

But look no further! I originally wrote this PGN reader for a website I was making, and I implemented the full parser (which is fast!), along with functionality to display the data read on the chess board UI.

## Installation

This reader will work with any kind of JavaScript (in the web browser or just NodeJS), so there really aren't that many requirements. Just download the single chess.js file and make sure it is in the same directory as the rest of your files.

## API Usage

Below is a demonstration of how to use this API.

```js
// it is assumed that the JS file was already included via the script tag

const the_pgn = '[Event "My Event"]\n[White "Player 1"]\n[Black "Player 2"]\n\n1. e4 e5 1-0'; // we will keep it simply here for the sake of the example
let pgn_read = null; // this is where we will store the data we read

async function getPGN() {
    pgn_read = await readPGN(the_pgn); // easy!
    // any errors that could occur will be put in the console

    for(var i = 0; i < pgn_read.memory_boards.length; i++) {
        const bd = pgn_read.memory_boards[i];
        // do something with the board after each move
        // the value of bd is a 2d array holding the whole position
        // more description about this value can be found in the "Extra Notes" section
    }
    console.log(pgn_read.header.white); // will output "Player 1" in the console
}

getPGN();
```

## Outputting Chess Board to HTML

To start with, make sure you have the following CSS in your html.
```html
<style>
div[data-chess-square] {
    text-align: center; /* this dictates the position of the piece in each square */
    font-size: 60px; /* this controls the piece size */
}

.chess-board {
    display: grid;
    grid-template-columns: auto auto auto auto auto auto auto auto;
    width: 512px; /* this is the width of the chess board! */
    height: 512px; /* make sure this value is the same as width, otherwise this won't look like a good square */
}
</style>

<!--We don't actually need to put anything into the div. The JavaScript will take care of that. Just make sure it has the following class and id-->
<div class="chess-board" id="chess_board"></div>
```

Finally, execute the following JavaScript.

```js
// we will use pgn read from the previous example
let board_output = new ChessBoard(pgn_read, 'chess_board');

board_output.init(); // this will output the current position

// we can control what position is displayed
board_output.pgn_board.key_position = 2;
board_output.init(); // this will output the position after 1... e5 is played since the key position is 2

// you can also access other parsed header data
console.log(board_output.pgn_board.header.white) // will output "test" in the console
console.log(board_output.pgn_board.result_str) // will output 1-0 in the console
```

You can also customize how the pieces appear or replace them with your own images. The example (along with a few other things you can modify) below shows how to do this.

```js
// we will assume board_output was already initialized from the previous example

board_output.piece_readable.set('WK', '<img src="custom_white_king.png">'); // note that whatever value we set here is the html it will output
board_output.light_square_color = '#f2f2f2' // you can also change the color of squares!
board_output.dark_square_color = '#000'

board_output.init() // always very important to call so that all changes apply
board_output.initFlip() // this will output the board reversed (i.e. from black side)
```

## Extra Notes

This is by far the most important section here, so make sure you understand it well, as it dictates how the API works.

To start with, this parser ignores illegal moves. That is, if an illegal move is played, it will still play that move. Please note that when I say illegal moves, I don't mean like a piece was moved incorrectly (e.g. Nb1-b2). This is something the parser can throw an error on. I am referring to moves where, for instance, the king is in check, and the actual move played doesn't defend the check.

This parser also only reads **short notation**.

This parser will also skip any text that implies analysis. In the example below, anything within the '{}' or '()' will be skipped and not parsed (even if the notation is incorrect).

```
1. e4 (1. c4 {because it is better...}) 1... e5 {standard opening}
```

Looking at the API, the __key\_position__ variable should represent the index of the position in __memory\_boards__. So this index should be in bounds.

Speaking of the __memory\_boards__ variable, the first element is always the starting position in that array. The next element will represent the move white made, and the next black made, and so on.

Within these arrays (__memory\_boards__ holds), there will be 2d arrays holding strings as values. Below is a list of what each value means (even though all of it should be obvious):

- (W|B)P -> (White|Black) Pawn
- (W|B)K -> (White|Black) King
- (W|B)Q -> (White|Black) Queen
- (W|B)R -> (White|Black) Rook
- (W|B)N -> (White|Black) Knight
- (W|B)B -> (White|Black) Bishop
- "" or " " or "\&nbsp;" -> empty square

Please note that index 0 of the board represents all the pieces on the first rank, index 1 represents the second rank and so on.

Lastly, this PGN parser doesn't set up the board given an FEN (in the format "[FEN ...]" for the game header).

## License

This small library is open source! It is licensed under MIT (see LICENSE file).
