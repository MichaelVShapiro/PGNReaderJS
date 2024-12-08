/**
 * chess.js
 * The ability to read PGN data in JavaScript
 * (c) 2024 Michael Shapiro
 * @version 1.0
 */

"use strict"

/**
 * Version number of this library
 */
const CHESS_PGN_READER_VERSION = 1.0

//MARK: PGN TOKEN DATA

const TT_DOT = 'DOT'
const TT_LETTER = 'LETTER'
const TT_NUM = 'NUM'
const TT_SYMBOL = 'SYMBOL'
const TT_DASH = 'DASH'
const TT_SLASH = 'SLASH'
const TT_MOVE_NUM = 'MOVE_NUM'
const TT_RES = 'RESULT'
const TT_GAME_DATA = 'GAME_DATA'
const TT_EQUALS = 'EQUALS'
const TT_CASTLE_KING = 'CASTLE_KING_SIDE'
const TT_CASTLE_QUEEN = 'CASTLE_QUEEN_SIDE'
const TT_BLACK_MOVE = 'BLACK_MOVE_SINGLE'
const TT_TEXT_ANALYSIS = 'TEXT_ANALYSIS'
const TT_MOVE_ANALYSIS = 'MOVE_ANALYSIS'
const VALID_PIECE_LETTERS = new Set(['R', 'N', 'B', 'Q', 'K', 'O'])
const VALID_BOARD_LETTERS = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])

//MARK: END PGN TOKEN DATA
//MARK: ERROR DATA

/**
 * Base class for error handling
 */
class PGNError extends Error {

    /**
     * Just an empty constructor
     */
    constructor() {
        super('')
        this.problem_short = 'Unknown'
        this.line = 0
        this.col = 0
    }
}

/**
 * Error during lexer phase
 */
class LexerError extends PGNError {

    /**
     * A detailed problem of what happened during the lexer
     * @param {String} problem Required. The problem
     * @param {Number} line Required. The line number on error
     * @param {Number} col Required. The col number on error
     */
    constructor(problem, line, col) {
        super()
        this.message = problem
        this.line = line
        this.col = col
    }
}

/**
 * Error during parsing phase
 */
class ParserError extends PGNError {

    /**
     * For constructing the parser error
     * @param {String} problem Required. The problem during parsing
     */
    constructor(problem) {
        super()
        this.problem_short = 'parser'
        this.message = problem
    }
}

/**
 * Error during interpreting phase
 */
class InterpretError extends PGNError {

    /**
     * Constructs with problem
     * @param {String} problem Required. The problem
     */
    constructor(problem) {
        super()
        this.problem_short = 'interpreter_error'
        this.message = problem
    }
}

//MARK: END ERROR DATA

/**
 * Single pgn node
 */
class PGNNode {

    constructor() {
        this.node_type = 'unknown'
    }
}

/**
 * For inputting pgn details
 */
class PGNDetail extends PGNNode {

    /**
     * PGN Detail in the [...] section
     * @param {String} type Required. Field type
     * @param {String} value Required. Value it holds
     */
    constructor(type, value) {
        super()
        this.type = type
        this.value = value
        this.node_type = 'detail'
    }
}

/**
 * A full move
 */
class PGNMove extends PGNNode {

    /**
     * Constructs given the two moves
     * @param {Object} white_move An object consisting of keys (where keys with '?' are optional): piece_type, target_square, from_rank?, from_file?
     * @param {Object | null} black_move Same as white move. But can be null if white move was final result of game
     */
    constructor(white_move, black_move) {
        super()
        this.node_type = 'move'
        this.white_move = white_move
        this.black_move = black_move
    }
}

/**
 * For recording result
 */
class PGNResult extends PGNNode {

    /**
     * For building the result
     * @param {String} res Required. The result
     */
    constructor(res) {
        super()
        this.res = res
        this.node_type = 'result'
    }
}

/**
 * A PGN token
 */
class PGNToken {

    /**
     * For creating the full pgn token
     * @param {String} type Required. A token type
     * @param {String} value Optional (null or value). The value the token holds
     */
    constructor(type, value) {
        this.type = type
        this.value = value
    }
}

/**
 * Just a subset type of the pgn token
 */
class PGNHeaderToken extends PGNToken {
    /**
     * For initializing data in header format
     * @param {String} header_type Required. The header type
     * @param {String} header_value Required. The header value
     */
    constructor(header_type, header_value) {
        super(TT_GAME_DATA, '')
        this.header_type = header_type
        this.header_value = header_value
    }
}

/**
 * Full pgn lexer
 */
class PGNLexer {

    /**
     * For constructing the lexer given data to make tokens out of
     * @param {String} data Required. The data
     */
    constructor(data) {
        this.data = data
        this.curr_token_index = -1
        this.curr_token = null
        this.alpha = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'r', 'n', 'b', 'q', 'k']) // this only contains letters which are used in notation
        this.num = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'])
        this.symbols = new Set(['/', '+', '#', '!', '?', 'x'])
        this.line_num = 1
        this.col_num = 1
        /**
         * Additional settings for lexing
         */
        this.settings = {
            /**
             * If text analysis (data in '{}' format) should be skipped and not returned
             */
            skip_text_analysis: true,
            /**
             * If move analysis (data in '()' format) should be skipped and not returned
             */
            skip_move_analysis: true
        }
    }

    /**
     * Advances the token
     */
    advance() {
        // make sure incrementing the token still yields a valid value
        if(this.curr_token_index + 1 >= this.data.length) {
            this.curr_token = null
            this.curr_token_index += 1
            return
        }

        // increment index and set new value
        this.curr_token_index += 1
        this.curr_token = this.data.substring(this.curr_token_index, this.curr_token_index + 1)
    }
    /**
     * Does the reverse of advance
     */
    unadvance() {
        if(this.curr_token_index - 1 < 0) {
            this.curr_token = null
            this.curr_token_index -= 1
            return
        }

        this.curr_token_index -= 1
        this.curr_token = this.data.substring(this.curr_token_index, this.curr_token_index + 1)
    }
    /**
     * Previews the next available token
     * @returns null | string
     */
    previewAdvance() {
        if(this.curr_token_index + 1 >= this.data.length) {
            return null
        }
        return this.data.substring(this.curr_token_index + 1, this.curr_token_index + 2)
    }
    /**
     * Previews the second next available token
     * @returns null | string
     */
    doublePreviewAdvance() {
        if(this.curr_token_index + 2 >= this.data.length) {
            return null
        }
        return this.data.substring(this.curr_token_index + 2, this.curr_token_index + 3)
    }
    /**
     * Determines if the given token can make a result
     * @returns null | string
     */
    canMakeResult() {
        // check if next character is valid
        if(this.previewAdvance() == null) {
            return null
        }
        // it is assumed that the first character (token) is a number
        let res = this.curr_token + ''
        let hit_slash = false
        // we should expect '-'
        let temp = new PGNLexer(this.data) // we can use another lexer for easy checking
        temp.curr_token_index = this.curr_token_index
        let curr = this.col_num
        temp.advance()
        curr += 1
        let draw_result = false
        // if res == 1 then the next token could also be /2
        // check for this while looping
        while(temp.curr_token != null) {
            if(temp.curr_token == ' ') {
                temp.advance()
                curr += 1
                continue
            }
            if(!hit_slash && res == '1' && temp.curr_token == '/') {
                // expect draw result
                draw_result = true
                res += '/'
                temp.advance()
                curr += 1
                continue
            }

            if(draw_result) {
                if(res.length == 2 || res.length == 6) {
                    // expect '2'
                    if(temp.curr_token != '2') {
                        return null
                    }
                    res += '2'
                    temp.advance()
                    curr += 1
                    if(res.length == 6) {
                        // we are done
                        break
                    }
                    continue
                } else if(res.length == 3) {
                    // expect '-'
                    if(temp.curr_token != '-') {
                        return null
                    }
                    res += '-'
                    temp.advance()
                    curr += 1
                    continue
                } else if(res.length == 4) {
                    // expect '1'
                    if(temp.curr_token != '1') {
                        return null
                    }
                    res += '1'
                    temp.advance()
                    curr += 1
                    continue
                } else if(res.length == 5) {
                    // expect '/'
                    if(temp.curr_token != '/') {
                        return null
                    }
                    res += '/'
                    temp.advance()
                    curr += 1
                    continue
                }
            } else {
                if(res.length == 1) {
                    // expect '-'
                    if(temp.curr_token != '-') {
                        return null
                    }
                    res += '-'
                    temp.advance()
                    curr += 1
                    continue
                } else if(res.length == 2) {
                    // expect 0/1
                    if(temp.curr_token != '0' && temp.curr_token != '1') {
                        return null
                    }
                    res += temp.curr_token
                    temp.advance()
                    curr += 1
                    break
                }
            }
        }

        // must have been successful
        // reset current token to whatever was in temp
        this.curr_token_index = temp.curr_token_index
        this.curr_token = temp.curr_token
        this.col_num = curr
        return new PGNToken(TT_RES, res)
    }
    /**
     * Makes the game data token
     * @returns the game data token
     * @throws An error upon lexing
     * @returns PGNToken
     */
    makeGameData() {
        // it is assumed that the current token is '['
        this.advance()
        this.col_num += 1
        // assert current token is not null
        if(this.curr_token == null) {
            throw new LexerError('Expected expression after \'[\'', this.line_num, this.col_num)
        }
        let data_name = ''
        let data_value = ''
        let touched_name = false

        while(this.curr_token !== null) {
            if(this.curr_token == '\n') {
                throw new LexerError('Unterminated game detail', this.line_num, this.col_num)
            }
            if(this.curr_token == ']') {
                break
            }
            if(this.curr_token == ' ') {
                if(!touched_name) {
                    touched_name = true
                    this.advance()
                    this.col_num += 1
                    continue
                }
            }
            if(!touched_name) {
                data_name += this.curr_token
                this.advance()
                this.col_num += 1
                continue
            }
            data_value += this.curr_token
            this.advance()
            this.col_num += 1
            continue
        }

        // assert current token is ']'
        if(this.curr_token != ']') {
            throw new LexerError('Expected \']\' but not found', this.line_num, this.col_num)
        }

        this.advance()
        this.col_num += 1
        return new PGNHeaderToken(data_name, data_value)
    }
    /**
     * Makes the castle data token
     * @returns the castle data token
     * @throws An error upon lexing
     */
    makeCastleToken() {
        // it is assumed the current token is 'o'
        this.advance()
        this.col_num += 1
        // expect '-'
        if(this.curr_token != '-') {
            throw new LexerError('Expected \'-\' in castle notation', 0, 0)
        }
        this.advance()
        this.col_num += 1
        // expect 'o'
        if(this.curr_token == null) {
            throw new LexerError('Expected \'o\' in castle notation', 0, 0)
        }
        if(this.curr_token.toLowerCase() != 'o') {
            throw new LexerError('Expected \'o\' in castle notation', 0, 0)
        }
        this.advance()
        this.col_num += 1
        // could also be queenside castle
        if(this.curr_token == null) {
            return new PGNToken(TT_CASTLE_KING, '')
        }
        if(this.curr_token != '-') {
            return new PGNToken(TT_CASTLE_KING, '')
        }
        this.advance()
        this.col_num += 1
        // expect 'o'
        if(this.curr_token == null || this.curr_token.toLowerCase() != 'o') {
            throw new LexerError('Expected \'o\' in castle notation')
        }

        this.advance()
        this.col_num += 1
        return new PGNToken(TT_CASTLE_QUEEN, '')
    }
    /**
     * Makes the number given the current token
     * @returns String
     */
    makeNumber() {
        // it is assumed the current token is a number
        let num = this.curr_token + ''

        this.advance()
        this.col_num += 1
        while(this.curr_token !== null && this.num.has(this.curr_token)) {
            num += this.curr_token
            this.advance()
            this.col_num += 1
        }

        return num
    }
    /**
     * Skips analysis written in the notation
     * @throws An error if the analysis is not terminated
     */
    skipAnalysis() {
        // it is assumed that the current token is '{'
        this.advance()
        this.col_num += 1
        let analysis_data = ''
        while(this.curr_token !== null && this.curr_token !== '}') {
            if(this.curr_token == '\n') {
                throw new LexerError('Untermined bracket: Expected \'}\'', this.line_num, this.col_num)
            }
            analysis_data += this.curr_token
            this.advance()
            this.col_num += 1
        }

        // make sure current token is '}'
        if(this.curr_token !== '}') {
            throw new LexerError('Unterminated analysis', this.line_num, this.col_num)
        }

        // advance past
        this.advance()
        this.col_num += 1

        return analysis_data
    }
    /**
     * Skips alt moves (or anything within the '(...)') in the notation
     * @throws An error if the bracket is not terminated
     */
    skipAltMoves() {
        // it is assumed that the current token is '('
        this.advance()
        this.col_num += 1
        // keep skipping while we still have some characters
        // and stop on ')'
        let alt_moves = ''
        while(this.curr_token !== null && this.curr_token !== ')') {
            if(this.curr_token == '(') {
                // we need to skip this
                const res = this.skipAltMoves()
                alt_moves += res
                continue
            } else if(this.curr_token == '\n') {
                throw new LexerError('Unterminated analysis: Expected \')\'', this.line_num, this.col_num)
            }
            alt_moves += this.curr_token
            this.advance()
            this.col_num += 1
        }

        // make sure we terminate correctly
        if(this.curr_token !== ')') {
            throw new LexerError('Unterminated analysis: Expected \')\'', this.line_num, this.col_num)
        }

        // skip this token
        this.advance()
        this.col_num += 1

        return alt_moves
    }
    /**
     * Determines if the current set of tokens follow the format: [move_num]...
     * @returns Token | null
     */
    canMakeBlackCheck() {
        // it is assumed that the current token is '.'
        // just check if the next two tokens are '.'
        if(this.previewAdvance() !== '.') {
            return null
        }
        if(this.doublePreviewAdvance() !== '.') {
            return null
        }

        return new PGNToken(TT_BLACK_MOVE, '')
    }
    /**
     * Makes the tokens
     * @returns A list of tokens
     * @throws An error on encountering an unexpected token
     */
    makeTokens() {
        let tokens = []

        this.advance()
        // keep rendering the tokens while we still can
        while(this.curr_token != null) {
            // ignore white spaces
            if(this.curr_token == ' ') {
                this.advance()
                this.col_num += 1
                continue
            } else if(this.curr_token == '\n') {
                this.line_num += 1
                this.col_num = 1
                this.advance()
                continue
            }

            // check data types
            if(this.num.has(this.curr_token)) {
                // construct number
                const num_con = this.makeNumber()
                // could be move num
                // try to form one if possible
                if(this.curr_token == '.') {
                    // check if black move is available
                    let p = this.canMakeBlackCheck()
                    if(p !== null) {
                        p.value = num_con
                        tokens.push(p)
                        this.advance()
                        this.advance()
                        this.advance()
                        this.col_num += 3
                        continue
                    }
                    // move number found!
                    tokens.push(new PGNToken(TT_MOVE_NUM, num_con)) // we only need the move number since that is more important
                    this.advance()
                    this.col_num += 1
                    continue
                }

                // maybe we can make a result?
                if(num_con.length == 1) {
                    this.unadvance()
                    const r = this.canMakeResult()
                    if(r !== null) {
                        tokens.push(r)
                        continue
                    } else {
                        this.advance()
                    }
                }

                // just number...
                tokens.push(new PGNToken(TT_NUM, num_con))
                continue
            } else if(this.alpha.has(this.curr_token.toLowerCase())) {
                tokens.push(new PGNToken(TT_LETTER, this.curr_token))
                this.advance()
                this.col_num += 1
                continue
            } else if(this.curr_token == '.') {
                tokens.push(new PGNToken(TT_DOT, '.'))
                this.advance()
                this.col_num += 1
                continue
            } else if(this.curr_token == '/') {
                tokens.push(new PGNToken(TT_SLASH, '/'))
                this.advance()
                this.col_num += 1
                continue
            } else if(this.symbols.has(this.curr_token)) {
                this.advance()
                this.col_num += 1
                // skip any symbols
                continue
            } else if(this.curr_token == '[') {
                tokens.push(this.makeGameData())
                continue
            } else if(this.curr_token == '=') {
                tokens.push(new PGNToken(TT_EQUALS, '='))
                this.advance()
                this.col_num += 1
                continue
            } else if(this.curr_token.toLowerCase() == 'o') {
                // castle token
                tokens.push(this.makeCastleToken())
                continue
            } else if(this.curr_token == '{') {
                // skip any analysis
                const res = this.skipAnalysis()
                if(!this.settings.skip_text_analysis) {
                    tokens.push(new PGNToken(TT_TEXT_ANALYSIS, res))
                }
                continue
            } else if(this.curr_token == '(') {
                // skip alt moves analysis
                const res = this.skipAltMoves()
                if(!this.settings.skip_move_analysis) {
                    tokens.push(new PGNToken(TT_MOVE_ANALYSIS, res))
                }
                continue
            }

            // unknown token!
            throw new LexerError(`Unknown token detected in PGN "${this.curr_token}"`, this.line_num, this.col_num)
        }

        return tokens
    }
}

/**
 * For parsing the tokens
 */
class PGNParser {

    /**
     * For parsing the tokens
     * @param {Array<PGNToken>} tokens Required. The tokens to parse
     */
    constructor(tokens) {
        // clear out any analysis tokens
        var fixed_tokens = []
        for(var i = 0; i < tokens.length; i++) {
            if(tokens[i].type == TT_TEXT_ANALYSIS || tokens[i].type == TT_MOVE_ANALYSIS || tokens[i].type == TT_BLACK_MOVE) {
                continue
            }
            fixed_tokens.push(tokens[i])
        }
        this.tokens = fixed_tokens
        this.token_index = -1
        this.curr_token = null
    }
    /**
     * For advancing the tokens
     */
    advance() {
        if(this.token_index + 1 >= this.tokens.length) {
            this.curr_token = null
            return
        }

        this.token_index += 1
        this.curr_token = this.tokens[this.token_index]
    }
    /**
     * Asserts a token is valid
     * @throws An error when the token is null
     */
    assertValid() {
        if(this.curr_token == null) {
            throw new ParserError('Unexpected error occured...')
        }
    }
    /**
     * Parses the move
     * @returns PGNMove
     * @throws An error upon parsing
     */
    parseMove() {
        // it is assumed the current token is the move number
        // we can skip it
        this.advance()
        let white_move = {piece_type: '', target_square: '', from_rank: null, from_file: null}
        let black_move = {piece_type: '', target_square: '', from_rank: null, from_file: null}
        let rendering_white = true
        while(this.curr_token !== null && this.curr_token.type !== TT_MOVE_NUM && this.curr_token.type !== TT_RES) {
            // check for castle
            if(this.curr_token.type == TT_CASTLE_KING) {
                if(rendering_white) {
                    white_move.piece_type = 'castle_king'
                    this.advance()
                    rendering_white = false
                    // make sure we skip the black move num if its there
                    if(this.curr_token !== null && this.curr_token.type == TT_BLACK_MOVE) {
                        this.advance()
                    }
                    continue
                } else {
                    black_move.piece_type = 'castle_king'
                    this.advance()
                }
                break
            } else if(this.curr_token.type == TT_CASTLE_QUEEN) {
                if(rendering_white) {
                    white_move.piece_type = 'castle_queen'
                    this.advance()
                    rendering_white = false
                    if(this.curr_token !== null && this.curr_token.type == TT_BLACK_MOVE) {
                        this.advance()
                    }
                    continue
                } else {
                    black_move.piece_type = 'castle_queen'
                    this.advance()
                }
                break
            }
            // we should expect some kind of character
            const piece_char = this.curr_token.value
            // lets see if this piece is a pawn or something else
            if(VALID_PIECE_LETTERS.has(piece_char)) {
                this.advance()
                this.assertValid()
                // this piece has been identified
                // render the square
                // the lexer already ignores the 'x' and other related symbols, so parsing here should be easy!

                // expect a letter
                if(this.curr_token.type !== TT_LETTER && this.curr_token.type !== TT_NUM) {
                    throw new ParserError('Expected letter after piece in notation for move')
                }
                let f1 = null
                let f2 = null
                let r1 = null
                let r2 = null

                if(this.curr_token.type == TT_LETTER) {
                    f1 = this.curr_token.value
                    this.advance()
                    this.assertValid()
                    // lets see if another letter follows!
                    if(this.curr_token.type == TT_LETTER) {
                        f2 = f1 + ''
                        f1 = this.curr_token.value
                        this.advance()
                        this.assertValid()
                    }
                } else if(this.curr_token.type == TT_NUM) {
                    r2 = this.curr_token.value
                    this.advance()
                    this.assertValid()
                    // a letter must follow
                    if(this.curr_token.type !== TT_LETTER) {
                        throw new ParserError('Invalid notation')
                    }
                    f1 = this.curr_token.value
                    this.advance()
                    this.assertValid()
                }

                // finally expect a number
                if(this.curr_token.type !== TT_NUM) {
                    throw new ParserError('Invalid notation')
                }
                r1 = this.curr_token.value
                this.advance()

                // check which area we add this data to
                if(rendering_white) {
                    rendering_white = false
                    white_move.piece_type = piece_char
                    white_move.target_square = f1 + r1
                    white_move.from_file = f2
                    white_move.from_rank = r2
                    if(this.curr_token !== null && this.curr_token.type == TT_BLACK_MOVE) {
                        this.advance()
                    }
                } else {
                    black_move.piece_type = piece_char
                    black_move.target_square = f1 + r1
                    black_move.from_file = f2
                    black_move.from_rank = r2
                    break
                }
            } else {
                // pawn move
                // if we have another letter different from the previous, we should see a capture
                let f1 = ''
                let f2 = null
                let r1 = ''
                let r2 = null
                // if(this.curr_token.type == TT_LETTER) {
                //     f2 = this.curr_token.value
                //     this.advance()
                //     this.assertValid()
                // }

                // expect square
                if(this.curr_token.type !== TT_LETTER) {
                    throw new ParserError('Invalid pawn notation')
                }
                f1 = this.curr_token.value
                this.advance()
                this.assertValid()
                // pawn capture?
                if(this.curr_token.type == TT_LETTER) {
                    f2 = f1 + ''
                    f1 = this.curr_token.value
                    this.advance()
                    this.assertValid()
                }
                if(this.curr_token.type !== TT_NUM) {
                    throw new ParserError('Invalid pawn notation')
                }
                r1 = this.curr_token.value
                this.advance()
                // promotion?
                if(this.curr_token !== null && this.curr_token.type == TT_EQUALS) {
                    this.advance()
                    this.assertValid()
                    if(this.curr_token.type !== TT_LETTER) {
                        throw new ParserError('Pawn promotion piece not detected')
                    }
                    r2 = this.curr_token.value
                    this.advance()
                }

                // finally we can construct
                if(rendering_white) {
                    rendering_white = false
                    white_move.piece_type = 'P'
                    white_move.target_square = f1 + r1
                    white_move.from_file = f2
                    white_move.from_rank = r2
                    if(this.curr_token !== null && this.curr_token.type == TT_BLACK_MOVE) {
                        this.advance()
                    }
                } else {
                    black_move.piece_type = 'P'
                    black_move.target_square = f1 + r1
                    black_move.from_file = f2
                    black_move.from_rank = r2
                    break
                }
            }
        }

        if(black_move.piece_type == '') {
            return new PGNMove(white_move, null)
        }

        return new PGNMove(white_move, black_move)
    }
    /**
     * Parses a header detail
     * @returns PGNDetail
     * @throws An error upon parsing
     */
    parseDetail() {
        // it is assumed that the current token is a header token
        // we just need to make sure the value is valid
        if(!(this.curr_token instanceof PGNHeaderToken)) {
            throw new ParserError('Unexpected error occured while parsing game header data: invalid token')
        }

        // it is valid as long as the start and end characters are double quotes
        if(this.curr_token.header_value.length <= 1) {
            throw new ParserError('Data header cannot have an empty value for type: ' + this.curr_token.header_type)
        }
        const start_char = this.curr_token.header_value.substring(0, 1)
        const end_char = this.curr_token.header_value.substring(this.curr_token.value.length - 1)

        if(start_char !== "\"" && end_char !== "\"") {
            throw new ParserError(`Data header "${this.curr_token.header_type}" is missing quotes for its value`)
        }

        // now remove both parts
        const header_v = this.curr_token.header_value.substring(1, this.curr_token.header_value.length - 1)
        const header_t = this.curr_token.header_type

        // advance
        this.advance()

        return new PGNDetail(header_t, header_v)
    }
    /**
     * Parses the tokens
     * @returns Array<PGNNode>
     * @throws An error upon parsing
     */
    parse() {
        var parsed_data = []
        // advance
        this.advance()

        // keep parsing while we still have tokens
        while(this.curr_token != null) {
            if(this.curr_token.type == TT_GAME_DATA) {
                parsed_data.push(this.parseDetail())
                continue
            } else if(this.curr_token.type == TT_MOVE_NUM) {
                // parse the move
                parsed_data.push(this.parseMove())
                continue
            } else if(this.curr_token.type == TT_RES) {
                // just pass it to the interpreter
                parsed_data.push(new PGNResult(this.curr_token.value))
                this.advance()
                continue
            }

            // some strange data...
            throw new ParserError('Parse Error: Notation is invalid')
        }

        return parsed_data
    }
}

/**
 * Main board where all the moves are stored
 */
class PGNBoard {

    /**
     * Empty default constructor
     */
    constructor() {
        this.memory_boards = []
        this.key_position = 0
        this.header = {}
        this.result_str = '0-0' // default since we don't know yet what happened in the game
        this.en_passant = false // INTERNAL USE ONLY!

        // first item should be inital position
        this.memory_boards.push(this.makeStartingPosition())
    }
    /**
     * Constructs the starting position of the board
     */
    makeStartingPosition() {
        let pos = new Array(8)
        for(var i = 0; i < pos.length; i++) {
            pos[i] = new Array(8)
            for(var z = 0; z < 8; z++) {
                pos[i][z] = '&nbsp;'
            }
        }

        // index 0-1 = white set up && 6-7 = black set up
        for(var i = 0; i < pos[1].length; i++) {
            pos[1][i] = 'WP'
            pos[6][i] = 'BP'
        }

        const order = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
        for(var i = 0; i < 8; i++) {
            pos[0][i] = `W${order[i]}`
            pos[7][i] = `B${order[i]}`
        }

        return pos
    }
    /**
     * Moves a piece from a square to a square
     * @param {String} from A two character string representing the square
     * @param {String} to Same as from
     * @param {Array<Array<String>>} bd Required. The memory board
     * @param {null} [promote=null] Optional. If the move is a pawn promotion, and the target square should be replaced with the given piece
     * @returns The newly constructed memory board
     */
    move(from, to, bd, promote = null) {
        const posf = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
        const ff = posf.indexOf(from.substring(0, 1).toLowerCase())
        const fr = Number(from.substring(1, 2)) - 1
        const tf = posf.indexOf(to.substring(0, 1).toLowerCase())
        const tr = Number(to.substring(1, 2)) - 1

        const piece_before = bd[fr][ff]
        bd[fr][ff] = '&nbsp;'
        bd[tr][tf] = piece_before
        if(promote !== null) {
            bd[tr][tf] = piece_before.substring(0, 1) + promote
        }

        // check ep inf
        if(this.en_passant) {
            this.en_passant = false
            // take lower rank and remove piece from there
            bd[fr][tf] = '&nbsp;'
        }

        return bd
    }
    /**
     * Gets a fresh board of the current position for editing
     */
    fresh() {
        const a = this.memory_boards[this.memory_boards.length - 1]
        // we must make a deep copy
        let b = new Array(8)
        for(var i = 0; i < 8; i++) {
            b[i] = [...a[i]]
        }

        return b
    }
    /**
     * Finds a pawn that can go to to target square given the fresh board
     * @param {String} from_file Required. A one character string representing the starting file of the pawn
     * @param {String} target_square Required. The full target square
     * @param {String} color Required. The color (W|B)
     * @returns Array<String>
     */
    findPawn(from_file, target_square, color) {
        let bd = this.fresh()
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
        // go through bd and find pawn that can get to target square
        const file_loc = files.indexOf(from_file)
        let from_rank = Number(target_square.substring(1, 2))
        if(color == "W") {
            from_rank -= 1 // for making a more accurate index
            // if we have any piece behind this rank, it is simply impossible for the pawn to 'jump' to that rank
            // we also skip this if the piece was captured on that square
            if(bd[from_rank][file_loc] == '&nbsp;' && from_file.toLowerCase() == target_square.substring(0, 1).toLowerCase()) {
                // we automatically assume that by the time this condition is touched, the move simply could not have possible been a capture
                // so just check the two lower squares
                if(bd[from_rank - 1][file_loc] == 'WP') {
                    // found!
                    return [from_file, from_rank]
                } else {
                    // since the move is not a capture, target rank must = 4 && pawn at target file and rank 2 moved
                    if(from_rank - 1 == 2) {
                        return [from_file, from_rank - 1]
                    }
                }
            }
            // do nothing!
        } else {
            // we will repeat the exact same process as done above
            // we don't need to increment rank since in theory the number already represents the index properly
            if(bd[from_rank - 1][file_loc] == '&nbsp;' && from_file.toLowerCase() == target_square.substring(0, 1).toLowerCase()) {
                if(bd[from_rank][file_loc] == 'BP') { // we make '+' since black panws go the other direction
                    return [from_file, from_rank + 1]
                }
                if(from_rank + 2 == 7) {
                    return [from_file, from_rank + 2]
                }
            }
        }

        if(from_file.toLowerCase() == target_square.substring(0, 1).toLowerCase()) {
            // return what we have right now
            return [from_file, from_rank.toString()]
        }

        // now we have to locate this pawn
        // our capture could have been en-passant or just a normal pawn capture
        if(color == "W") {
            // check first level rank
            const bd_level = bd[from_rank - 1]
            // get location of final square
            const tf_loc = files.indexOf(target_square.substring(0, 1))
            // if we see a black pawn adjacent to our current, then we have enpassant
            if(bd_level[tf_loc] == 'BP') {
                this.en_passant = true
            }
            return [from_file, from_rank]
        } else {
            // same operation is W
            const bd_level = bd[from_rank]
            const tf_loc = files.indexOf(target_square.substring(0, 1))
            if(bd_level[tf_loc] == 'WP') {
                this.en_passant = true
            }
            return [from_file, from_rank + 1]
        }

        return null // no valid pawn exists
    }
    /**
     * A helper function for findKing. Checks if the king exists on the given square information
     * @param {Number} check_file Required. Index of file to check
     * @param {Number} check_rank Required. Index of rank to check
     * @param {String} color Required. Color of king
     * @returns Boolean
     */
    kingExists(check_file, check_rank, color) {
        // make sure file and rank are in founds
        if(check_file < 0 || check_file >= 8) {
            return false
        }
        if(check_rank < 0 || check_rank >= 8) {
            return false
        }

        return this.memory_boards[this.memory_boards.length - 1][check_rank][check_file] == `${color}K`
    }
    /**
     * Finds what square the king is on the given color on the fresh board
     * @param {String} target_file Required. The target file
     * @param {String} target_rank Required. The target rank
     * @param {String} color Required. A one character string to represent the color
     * @returns String
     */
    findKing(target_file, target_rank, color) {
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

        const tf_loc = files.indexOf(target_file)
        const tr_loc = Number(target_rank) - 1

        // look for squares around the target to find king
        const squares_check = [
            [tf_loc - 1, tr_loc], // left side
            [tf_loc + 1, tr_loc], // right side
            [tf_loc, tr_loc + 1], // upper side
            [tf_loc, tr_loc - 1], // lower side
            [tf_loc - 1, tr_loc + 1], // upper left
            [tf_loc + 1, tr_loc + 1], // upper right
            [tf_loc - 1, tr_loc - 1], // lower left
            [tf_loc + 1, tr_loc - 1] // lower right
        ]

        for(var i = 0; i < squares_check.length; i++) {
            if(this.kingExists(squares_check[i][0], squares_check[i][1], color)) {
                return files[squares_check[i][0]] + (squares_check[i][1] + 1)
            }
        }
        
        return null // impossible to reach since the king must exist in the position
    }
    /**
     * Finds what square the rook is on given the color and target square information
     * @param {String} target_file Required. The target file
     * @param {String} target_rank Required. The target rank
     * @param {String} color Required. The color
     * @param {String} specification Required. If the notation specified any specifications
     * @param {string} [p_check='R'] INTERNAL USE ONLY!
     * @returns String
     */
    findRook(target_file, target_rank, color, specification, p_check = 'R') {
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
        const tf_loc = files.indexOf(target_file)
        const tr_loc = Number(target_rank) - 1
        const bd = this.fresh()

        // we don't have to run through the whole board
        // lets use logic

        // first check the rank of the target square
        // check for any rooks on that rank
        const r_check = bd[tr_loc]
        for(var i = 0; i < 8; i++) {
            if(r_check[i] == `${color}${p_check}`) {
                // check for specification
                if(specification == null) {
                    // the last thing we have to check is if the rook can actually get to the square
                    // in other words, we just have to make sure none of the pieces are in front of it

                    let squares_ok = true
                    if(tf_loc < i) {
                        // check all squares between (tf_loc,i)
                        for(var z = tf_loc + 1; z < i; z++) {
                            if(r_check[z] !== '&nbsp;') {
                                // doesn't work anymore
                                squares_ok = false
                                break
                            }
                        }
                    } else {
                        // check all squares between (i, tf_loc)
                        for(var z = i + 1; z < tf_loc; z++) {
                            if(r_check[z] !== '&nbsp;') {
                                squares_ok = false
                                break
                            }
                        }
                    }

                    // check status
                    if(!squares_ok) {
                        continue // look for another rook
                    }

                    // we found the rook!
                    return files[i] + target_rank
                }

                // check if the specification is about the file/rank
                if(isNaN(specification)) {
                    // lets see if files match up
                    if(files[i] == specification) {
                        // we found the rook!
                        return files[i] + target_rank
                    }
                    continue
                }

                // check if ranks match
                if(Number(specification) == target_rank) {
                    // we found the rook!
                    return files[i] + target_rank
                }
            }
        }

        // in that case we need to check each file carefully for every rank
        for(var i = 0; i < 8; i++) {
            if(bd[i][tf_loc] == `${color}${p_check}`) {
                // we will run the exact same checks
                if(specification == null) {
                    let squares_ok = true

                    let start_check = Math.min(i, tr_loc)
                    let stop_check = Math.max(i, tr_loc)
                    for(var z = start_check + 1; z < stop_check; z++) {
                        if(bd[z][tf_loc] !== '&nbsp;') {
                            squares_ok = false
                            break
                        }
                    }

                    if(!squares_ok) {
                        continue
                    }

                    return target_file + String(i + 1)
                }

                if(isNaN(specification)) {
                    if(target_file == specification) {
                        return target_file + String(i + 1)
                    }
                    continue
                }

                if(Number(specification) == i + 1) {
                    return target_file + String(i + 1)
                }
            }
        }

        return null
    }
    /**
     * Quick partitioning for bishop
     * @param {Number} start_f Required. Starting position for file
     * @param {Number} start_r Required. Starting position for rank
     * @param {Number} i_increment Required. Direction i increments
     * @param {Number} z_increment Required. Direction z increments
     * @param {Number} i_stop Required. Number i stops at
     * @param {Number} z_stop Required. Number z stops at
     * @param {String} color Required. Color
     * @param {String} specification Required. Specification
     * @param {String} p_check INTERNAL USE ONLY!
     * @returns String
     */
    bishopPartition(start_f, start_r, i_increment, z_increment, i_stop, z_stop, color, specification, p_check = 'B') {
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
        const bd = this.fresh()
        var i = start_f
        var z = start_r
        while(i != i_stop && z != z_stop) {
            if(bd[z][i] == `${color}${p_check}`) {
                // check for specifications
                if(specification == null) {
                    return files[i] + String(z + 1)
                }

                // do usual checks
                if(isNaN(specification)) {
                    if(files[i] == specification) {
                        return files[i] + String(z + 1)
                    }
                    i += i_increment
                    z += z_increment
                    continue
                }
                if(z + 1 == Number(specification)) {
                    return files[i] + String(z + 1)
                }
            }
            i += i_increment
            z += z_increment
        }

        return null
    }
    /**
     * Finds what square the bishop is on given the color and target square information
     * @param {String} target_file Required. The target file
     * @param {String} target_rank Required. The target rank
     * @param {String} color Required. The color
     * @param {String} specification Required. If the notation specified any specifications
     * @param {string} [p_check='B'] INTERNAL USE ONLY!
     * @returns String
     */
    findBishop(target_file, target_rank, color, specification, p_check = 'B') {
        // there really is no 'best' way to approach this
        // just look for diagonals around the fresh board
        const bd = this.fresh()
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
        const tf_loc = files.indexOf(target_file)
        const tr_loc = Number(target_rank) - 1

        // up-left
        const ul = this.bishopPartition(tf_loc, tr_loc, -1, 1, -1, 8, color, specification, p_check)
        if(ul !== null) {
            return ul
        }

        // up-right
        const ur = this.bishopPartition(tf_loc, tr_loc, 1, 1, 8, 8, color, specification, p_check)
        if(ur !== null) {
            return ur
        }

        // down-left
        const dl = this.bishopPartition(tf_loc, tr_loc, -1, -1, -1, -1, color, specification, p_check)
        if(dl !== null) {
            return dl
        }

        // down-right
        const dr = this.bishopPartition(tf_loc, tr_loc, 1, -1, 8, -1, color, specification, p_check)

        return dr
    }
    /**
     * Finds what square the queen is on given the color and target square information
     * @param {String} target_file Required. The target file
     * @param {String} target_rank Required. The target rank
     * @param {String} color Required. The color
     * @param {String} specification Required. If the notation specificed any specifications
     * @returns String
     */
    findQueen(target_file, target_rank, color, specification) {
        // just call rook and bishop functions
        const r = this.findRook(target_file, target_rank, color, specification, 'Q')
        if(r !== null) {
            return r
        }

        return this.findBishop(target_file, target_rank, color, specification, 'Q')
    }
    /**
     * Finds what square the knight is on given the color and target square information
     * @param {String} target_file Required. The target file
     * @param {String} target_rank Required. The target rank
     * @param {String} color Required. The color
     * @param {String} specification Required. If the notation specified any specifications
     * @returns String
     */
    findKnight(target_file, target_rank, color, specification) {
        // a knight will only be able to move to eight possible squares
        // we will check them all

        // check upper
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
        const tf_loc = files.indexOf(target_file)
        const tr_loc = Number(target_rank) - 1
        const bd = this.fresh()

        let squares_explore = []
        if(tf_loc - 2 >= 0 && tr_loc + 1 < 8) {
            squares_explore.push([tf_loc - 2, tr_loc + 1])
        }
        if(tf_loc - 1 >= 0 && tr_loc + 2 < 8) {
            squares_explore.push([tf_loc - 1, tr_loc + 2])
        }
        if(tf_loc + 1 < 8 && tr_loc + 2 < 8) {
            squares_explore.push([tf_loc + 1, tr_loc + 2])
        }
        if(tf_loc + 2 < 8 && tr_loc + 1 < 8) {
            squares_explore.push([tf_loc + 2, tr_loc + 1])
        }

        // now lower spaces
        if(tf_loc - 2 >= 0 && tr_loc - 1 >= 0) {
            squares_explore.push([tf_loc - 2, tr_loc - 1])
        }
        if(tf_loc - 1 >= 0 && tr_loc - 2 >= 0) {
            squares_explore.push([tf_loc - 1, tr_loc - 2])
        }
        if(tf_loc + 1 < 8 && tr_loc - 2 >= 0) {
            squares_explore.push([tf_loc + 1, tr_loc - 2])
        }
        if(tf_loc + 2 < 8 && tr_loc - 1 >= 0) {
            squares_explore.push([tf_loc + 2, tr_loc - 1])
        }

        // now partition over the squares to explore
        for(var i = 0; i < squares_explore.length; i++) {
            if(bd[squares_explore[i][1]][squares_explore[i][0]] == `${color}N`) {
                if(specification == null) {
                    // knight found!
                    return files[squares_explore[i][0]] + String(squares_explore[i][1] + 1)
                }

                // check if square meets specification
                if(isNaN(specification)) {
                    if(files[squares_explore[i][0]] == specification) {
                        return files[squares_explore[i][0]] + String(squares_explore[i][1] + 1) 
                    }
                    continue
                }

                if(Number(specification) == squares_explore[i][1] + 1) {
                    return files[squares_explore[i][0]] + String(squares_explore[i][1] + 1)
                }
            }
        }

        return null
    }
}

/**
 * A interpreter for the pgn
 */
class PGNInterpreter {

    /**
     * Constructs the interpreter given the parsed nodes
     * @param {Array<PGNNode>} nodes Required. The nodes parsed
     */
    constructor(nodes) {
        this.nodes = nodes
        this.bd = new PGNBoard()
        this.white = ''
        this.black = ''
        // DO NOT MODIFY THE LOWER VARIABLES!
        // INTERNAL USE ONLY!
        this.white_king_moved = false // if white king moved (castle included)
        this.black_king_moved = false // if black king moved (castle included)
    }

    /**
     * Interprets the node given the detail
     * @param {PGNDetail} i Required. The detail of the node
     */
    interpretDetail(i) {
        if(i.type.toLowerCase() == 'white') {
            this.white = i.value
        } else if(i.type.toLowerCase() == 'black') {
            this.black = i.value
        }
        // load other data into board
        this.bd.header[i.type.toLowerCase()] = i.value
    }
    /**
     * Castles for white
     * @param {Boolean} kingside Required. If kingside should be done
     */
    applyWhiteCastle(kingside) {
        // it is assumed that castling is legal
        let bdf = this.bd.fresh()
        if(kingside) {
            bdf[0][4] = ''
            bdf[0][7] = ''
            bdf[0][6] = 'WK'
            bdf[0][5] = 'WR'
        } else {
            bdf[0][4] = ''
            bdf[0][0] = ''
            bdf[0][2] = 'WK'
            bdf[0][3] = 'WR'
        }

        return bdf
    }
    /**
     * Castles for black
     * @param {Boolean} kingside Required. If kingside should be done
     */
    applyBlackCastle(kingside) {
        let bdf = this.bd.fresh()
        if(kingside) {
            bdf[7][4] = ''
            bdf[7][7] = ''
            bdf[7][6] = 'BK'
            bdf[7][5] = 'BR'
        } else {
            bdf[7][4] = ''
            bdf[7][0] = ''
            bdf[7][2] = 'BK'
            bdf[7][3] = 'BR'
        }
        return bdf
    }
    /**
     * Converts the move to something machine readable
     * @param {Object} move Required. The move extracted
     * @param {String} color Required. The color to inspect on
     * @returns Array<String>
     */
    getMachineMove(move, color) {
        let machine_move = new Array(2)
        const tf = move.target_square.substring(0, 1)
        const tr = move.target_square.substring(1, 2)
        let spec = null
        if(move.from_file !== null) {
            spec = move.from_file
        }
        if(move.from_rank !== null) {
            spec = move.from_rank
        }
        // check if move is pawn move
        if(move.piece_type == 'P') {
            const original_file = (move.from_file != null ? move.from_file : move.target_square.substring(0, 1))
            const target_square = move.target_square
            const pos = this.bd.findPawn(original_file, target_square, color)
            if(pos == null) {
                return []
            }
            machine_move[0] = pos[0] + pos[1]
            machine_move[1] = target_square
        } else if(move.piece_type == 'K') {
            // this is easy!
            // just search for the king
            const pos = this.bd.findKing(tf, tr, color)
            if(pos == null) {
                return []
            }
            machine_move[0] = pos
            machine_move[1] = move.target_square
        } else if(move.piece_type == 'Q') {
            const pos = this.bd.findQueen(tf, tr, color, spec)
            if(pos == null) {
                return []
            }
            machine_move[0] = pos
            machine_move[1] = move.target_square
        } else if(move.piece_type == 'R') {
            const pos = this.bd.findRook(tf, tr, color, spec)
            if(pos == null) {
                return []
            }
            machine_move[0] = pos
            machine_move[1] = move.target_square
        } else if(move.piece_type == 'B') {
            const pos = this.bd.findBishop(tf, tr, color, spec)
            if(pos == null) {
                return []
            }
            machine_move[0] = pos
            machine_move[1] = move.target_square
        } else if(move.piece_type == 'N') {
            const pos = this.bd.findKnight(tf, tr, color, spec)
            if(pos == null) {
                return []
            }
            machine_move[0] = pos
            machine_move[1] = move.target_square
        }

        return machine_move
    }
    /**
     * Interprets the node given the move
     * @param {PGNMove} i Required. The move
     * @throws An error if the move cannot be determined
     */
    interpretMove(i) {
        // check what kind of move white has
        if(i.white_move.piece_type == 'castle_king') {
            // lets see if the king already moved
            if(this.white_king_moved) {
                throw new InterpretError('White cannot castle kingside because the king already moved')
            }
            const wcks = this.applyWhiteCastle(true)
            this.bd.memory_boards.push(wcks)
            this.white_king_moved = true
        } else if(i.white_move.piece_type == 'castle_queen') {
            // do same check as before
            if(this.white_king_moved) {
                throw new InterpretError('White cannot castle queenside because the king already moved')
            }
            const wcqs = this.applyWhiteCastle(false)
            this.bd.memory_boards.push(wcqs)
            this.white_king_moved = true
        } else {
            const move = this.getMachineMove(i.white_move, 'W')
            if(move.length === 0) {
                throw new InterpretError('Cannot interpret move because no valid piece can reach the target square: ' + JSON.stringify(i.white_move))
            }
            // check if king moved
            if(i.white_move.piece_type == 'K') {
                this.white_king_moved = true // we need this for asserting if king can castle
            }
            const should_promote = i.white_move.piece_type == 'P' && i.white_move.from_rank !== null
            const promote_type = i.white_move.from_rank
            this.bd.memory_boards.push(this.bd.move(move[0], move[1], this.bd.fresh(), (should_promote ? promote_type : null)))
        }

        // now do black if there even is a move to do
        if(i.black_move !== null) {
            if(i.black_move.piece_type == 'castle_king') {
                // we will apply all the same checks as done with the white king
                if(this.black_king_moved) {
                    throw new InterpretError('Black cannot castle queenside because the king already moved')
                }
                const bcks = this.applyBlackCastle(true)
                this.bd.memory_boards.push(bcks)
                this.black_king_moved = true
            } else if(i.black_move.piece_type == 'castle_queen') {
                if(this.black_king_moved) {
                    throw new InterpretError('Black cannot castle queenside because the king already moved')
                }
                const bcqs = this.applyBlackCastle(false)
                this.bd.memory_boards.push(bcqs)
                this.black_king_moved = true
            } else {
                const move = this.getMachineMove(i.black_move, 'B')
                if(move.length === 0) {
                    throw new InterpretError('Cannot interpret move because no valid piece can reach the target square: ' + JSON.stringify(i.black_move))
                }
                if(i.black_move.piece_type == 'K') {
                    this.black_king_moved = true
                }
                const should_promote = i.black_move.piece_type == 'P' && i.black_move.from_rank !== null
                const promote_type = i.black_move.from_rank
                this.bd.memory_boards.push(this.bd.move(move[0], move[1], this.bd.fresh(), (should_promote ? promote_type : null)))
            }
        }
    }
    /**
     * Interpretes the nodes and logs all the memory boards into bd
     */
    interpret() {
        for(var i = 0; i < this.nodes.length; i++) {
            if(this.nodes[i] instanceof PGNDetail) {
                this.interpretDetail(this.nodes[i])
            } else if(this.nodes[i] instanceof PGNMove) {
                this.interpretMove(this.nodes[i])
            } else if(this.nodes[i] instanceof PGNResult) {
                // just set the result
                this.bd.result_str = this.nodes[i].res
            }
        }
    }
}

/**
 * Reads the pgn
 * @param {String} pgn Required. The PGN to read
 * @returns PGNBoard
 */
async function readPGN(pgn) {
    // we will run this on another thread
    // that way there won't be any UI irresponsivness or other parts of the JavaScript not responding
    const renderer = new Promise((resolve, reject) => {
        // execute in try-catch to get any errors
        try {
            // make the lexer
            const lexer = new PGNLexer(pgn)
            // make the tokens
            const tokens = lexer.makeTokens()

            // make the parser
            const parser = new PGNParser(tokens)
            // parse the tokens into nodes
            const nodes = parser.parse()

            // make the interpreter
            const interpreter = new PGNInterpreter(nodes)
            // interpret the nodes
            interpreter.interpret()

            // return the board
            resolve(interpreter.bd)
        } catch (error) {
            reject(error)
        }
    })

    const data = await renderer
    if(typeof data == "object") {
        return data
    }

    throw new Error(data)
}

/**
 * This is what will display the UI board
 */
class ChessBoard {

    /**
     * Construct the game given the pgn board
     * @param {PGNBoard} pgn_board Required. The game to show
     * @param {String} bd_id Required. The element to make the board on
     */
    constructor(pgn_board, bd_id) {
        this.pgn_board = pgn_board
        this.bd_id = bd_id
        /**
         * This is the text that will be displayed in html
         */
        this.piece_readable = new Map([
            ['&nbsp;', '&nbsp;'],
            ['WP', '&#9817;'],
            ['WR', '&#9814;'],
            ['WN', '&#9816;'],
            ['WB', '&#9815;'],
            ['WQ', '&#9813;'],
            ['WK', '&#9812;'],
            ['BP', '&#9823;'],
            ['BR', '&#9820;'],
            ['BN', '&#9822;'],
            ['BB', '&#9821;'],
            ['BQ', '&#9819;'],
            ['BK', '&#9818;'],
            ['', '&nbsp;'],
            [' ', '&nbsp;']
        ])
        /**
         * This represents the color of the light square
         */
        this.light_square_color = '#fff'
        /**
         * This represents the color of the dark square
         */
        this.dark_square_color = '#d2d2d2'
    }
    /**
     * Validates the piece html so that it is outputted safely
     * @param {String} piece Required. A string which represents the piece to parse
     */
    sanitize(piece) {
        // data in this.piece_readable is actually quite unsafe at the moment
        // anybody can insert script tags in there
        // essentially, the innerHTML property is used to output the data, so we need to stop script tags from getting loaded
        // or php generally

        // the following regular expression was adapted from: https://stackoverflow.com/questions/16585635/how-to-find-script-tag-from-the-string-with-javascript-regular-expression
        // also adapted from: https://stackoverflow.com/questions/6484995/javascript-regular-expression-to-find-php-tags
        const re = /<script\b[^>]*>[\s\S]*?<\/script\b[^>]*>/g
        const re_php = /<\?[=|php]?[\s\S]*?\?>/g
        if(re.test(piece) || re_php.test(piece)) {
            // deliberatly replace all occurences of '<' and '>'
            const piece_fixed = piece.replace('<', '&lt;').replace('>', '&gt;')
            return piece_fixed
        }

        // we are good
        return piece
    }
    /**
     * Initializes the UI board only
     */
    init() {
        // clear everything currently on the board
        document.getElementById(this.bd_id).innerHTML = ''

        // form the squares
        // retrieve square dimensions
        const width = Number(document.getElementById(this.bd_id).getAttribute('data-chess-square-width'))
        const height = Number(document.getElementById(this.bd_id).getAttribute('data-chess-square-height'))

        // make a copy of the array
        let f = [...this.pgn_board.memory_boards[this.pgn_board.key_position]]
        // the array will appear flipped
        // so reverse it
        f = f.reverse()

        // the board is constructed from top 8th rank to lowest 1st rank
        // top square is light and alternates from there
        var square_col = this.light_square_color + ''
        for(var i = 0; i < 8; i++) {
            for(var z = 0; z < 8; z++) {
                const html_piece = this.sanitize(this.piece_readable.get(f[i][z]))
                document.getElementById(this.bd_id).innerHTML += '<div style="background-color: ' + square_col + '; width: ' + width + 'px; heigt: ' + height + 'px;" data-chess-square="true">' + html_piece + '</div>'
                if(square_col == this.light_square_color) {
                    square_col = this.dark_square_color
                } else {
                    square_col = this.light_square_color
                }
            }
            if(square_col == this.light_square_color) {
                square_col = this.dark_square_color
            } else {
                square_col = this.light_square_color
            }
        }
    }
    /**
     * Displays the board flipped (from Blacks point of view)
     */
    initFlip() {
        // clear everything like init does
        document.getElementById(this.bd_id).innerHTML = ''

        const width = Number(document.getElementById(this.bd_id).getAttribute('data-chess-square-width'))
        const height = Number(document.getElementById(this.bd_id).getAttribute('data-chess-square-height'))

        // we basically do the exact same thing as in init, just this time instead of reversing the whole board, we only reverse the elements within
        let f = [...this.pgn_board.memory_boards[this.pgn_board.key_position]]

        var square_col = this.light_square_color + ''
        for(var i = 0; i < 8; i++) {
            f[i] = f[i].reverse()
            for(var z = 0; z < 8; z++) {
                const html_piece = this.sanitize(this.piece_readable.get(f[i][z]))
                document.getElementById(this.bd_id).innerHTML += '<div style="background-color: ' + square_col + '; width: ' + width + 'px; height: ' + height + 'px;" data-chess-square="true">' + html_piece + '</div>'
                if(square_col == this.light_square_color) {
                    square_col = this.dark_square_color
                } else {
                    square_col = this.light_square_color
                }
            }
            if(square_col == this.light_square_color) {
                square_col = this.dark_square_color
            } else {
                square_col = this.light_square_color
            }
        }
    }
}