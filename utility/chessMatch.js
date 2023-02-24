const { Chess } = require("chess.js");
const { EventEmitter } = require("node:events")

class ChessMatch
{
    constructor()
    {
        this.chess = new Chess();
        this.eventEmitter = new EventEmitter();
    }
    getTurn()
    {
        return this.chess.turn()
    }

    getIsDraw()
    {
        return this.chess.isDraw();
    }
    getIsStalemate()
    {
        return this.chess.isStalemate();
    }

    getMatchResult()
    {
        if (!this.getIsGameOver())
        {
            return MatchResult.Ongoing;
        }
        if (this.getIsStalemate())
        {
            return MatchResult.Stalemate;
        }
        if (this.getIsDraw())
        {
            return MatchResult.Draw;
        }
        if (this.chess.isCheckmate())
        {
            if (this.getTurn() === "w")
            {
                return MatchResult.BlackWins;
            }
            return MatchResult.WhiteWins;
        }
        if (this.resignedColor !== "")
        {
            switch (this.resignedColor)
            {
                case "w":
                    return MatchResult.BlackWins;
                    break;
                case "b":
                    return MatchResult.WhiteWins;
                    break;
            }
        }
    }


    getIsGameOver()
    {
        return this.chess.isGameOver() || this.resignedColor != ""
    }

    getIsCheck()
    {
        return this.chess.isCheckmate()
    }

    move(value)
    {
        if (this.getIsGameOver())
        {
            return MoveResult.Invalid;
        }
        try
        {
            var madeMove = this.chess.move(value)
            if (this.getIsGameOver())
            {
                this.eventEmitter.emit("ended", this.getMatchResult());
            } else
            {
                this.eventEmitter.emit("moved", madeMove.san)
            }
            return MoveResult.Valid
        }
        catch (e)
        {
            return MoveResult.Invalid;
        }
    }

    resign(color)
    {
        this.resignedColor = color
    }

    getFEN()
    {
        return this.chess.fen();
    }
}

const MoveResult = {
    Valid: 0,
    Invalid: 1,
}
const MatchResult = {
    WhiteWins: 0,
    BlackWins: 1,
    Stalemate: 2,
    Draw: 3,
    Ongoing: 4
}

module.exports = {
    ChessMatch,
    MoveResult,
    MatchResult
}