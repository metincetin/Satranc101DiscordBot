const { Chess } = require("chess.js");
const { EventEmitter } = require("node:events")
const crypto = require("node:crypto")


class ChessMatch
{
    constructor()
    {
        this.chess = new Chess();
        this.eventEmitter = new EventEmitter();
        this.id = crypto.randomUUID();
        this.resignedColor = ""
        this.acceptedDraw = false
    }
    getTurn()
    {
        return this.chess.turn()
    }

    getIsDraw()
    {
        return this.chess.isDraw() || this.acceptedDraw;
    }
    getIsStalemate()
    {
        return this.chess.isStalemate();
    }
    getIsCheckmate()
    {
        return this.chess.isCheckmate();
    }

    getWinner()
    {
        var result = this.getMatchResult();
        if (result == MatchResult.Resignation)
        {
            if (this.resignedColor == "w")
                return "b";
            else
                return "w"
        }
        if (result == MatchResult.Checkmate)
        {
            if (this.getTurn() === "w") {
                return "b";
            }
            return "w;"
        }
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
        if (this.getIsCheckmate())
        {
            return MatchResult.Checkmate;
        }
        if (this.resignedColor !== "")
        {
            return MatchResult.Resignation;
        }
    }


    getIsGameOver()
    {
        return this.chess.isGameOver() || this.resignedColor !== "" || this.acceptedDraw    ;
    }

    getIsCheck()
    {
        return this.chess.isCheck()
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
            console.log(madeMove)
            return MoveResult.Valid
        }
        catch (e)
        {
            console.log(e);
            return MoveResult.Invalid;
        }
    }
    
    resign(color)
    {
        this.resignedColor = color
        this.eventEmitter.emit("ended", this.getMatchResult())
    }

    draw(){
        this.acceptedDraw = true
        this.eventEmitter.emit("ended", this.getMatchResult());
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
    Checkmate: 0,
    Stalemate: 1,
    Draw: 2,
    Resignation: 3,
    Ongoing: 4,
    Canceled: 5,
    toString: function (v)
    {
        switch (v)
        {
            case 0:
                return "Şah mat"
            case 1:
                return "Pat"
            case 2:
                return "Berabere"
            case 3:
                return "Maçtan Çekilme"
            case 5:
                return "İptal"
        }
        return "Invalid Input"
    }
}

module.exports = {
    ChessMatch,
    MoveResult,
    MatchResult
}