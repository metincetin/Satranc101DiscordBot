const { ChessMatch, MatchResult } = require("../../utility/chessMatch");
const { EventEmitter } = require("node:events");
const { ChessboardBuilder } = require("../../utility/chessboardBuilder");

class BlindfoldSystem
{
    constructor()
    {
        this.matches = []
        this.matchmakingQueue = []
        this.eventEmitter = new EventEmitter();
    }

    static start(client)
    {
        BlindfoldSystem.instance = new BlindfoldSystem();
        BlindfoldSystem.instance.client = client
        console.log("Blindfold system started")
        return BlindfoldSystem.instance;
    }

    addToQueue(playerId)
    {
        if (this.matchmakingQueue.includes(playerId)) return;
        this.matchmakingQueue.push(playerId)
        console.log(`Added player ${playerId} to queue`)

        this.checkQueueForMatch()
    }

    checkQueueForMatch()
    {
        this.matchmakingQueue.forEach(playerIdA =>
        {
            this.matchmakingQueue.forEach(playerIdB =>
            {
                if (this.isValidForMatch(playerIdA, playerIdB))
                {
                    this.startMatch(playerIdA, playerIdB);
                    this.checkQueueForMatch();
                    return;
                }
            });
        });
    }

    leaveQueue(playerId)
    {
        this.matchmakingQueue = this.matchmakingQueue.filter(x => x != playerId);
    }

    startMatch(playerIdA, playerIdB)
    {

        this.leaveQueue(playerIdA)
        this.leaveQueue(playerIdB)
        // remove players from matchmaking queue
        let match = new ChessMatch()

        // do randomization for color here?
        let matchInstance = new MatchInstance(playerIdA, playerIdB, match, this.client);

        this.matches.push(matchInstance)

        this.eventEmitter.emit("matchStarted", matchInstance);

        match.eventEmitter.on("moved", (move) =>
        {
            this.onMoveMade(matchInstance, move)
        })
        match.eventEmitter.on("ended", (result) =>
        {
            this.onMatchEnded(matchInstance, result)
        })
        console.log(`Match started: white ${playerIdA}, black: ${playerIdB}`)
       
        this.client.users.fetch(playerIdA).then(whitePlayer => {
            this.client.users.fetch(playerIdB).then(blackPlayer => {
                whitePlayer.send({content:`Maç başladı. Rakibin: ${blackPlayer}. Beyaz taşlar sende ve hamle senin. \`/blindfold move\` ile oynayabilirsin`, ephemeral: true})
                blackPlayer.send({content: `Maç başladı. Rakibin ${whitePlayer}. Siyah taşlar sende. Rakibinin hamlesini bekle`, ephemeral: true})
            })
        })
    }

    async onMoveMade(matchInstance, move)
    {
        let newTurnPlayerId = matchInstance.match.getTurn() === "w" ? matchInstance.white : matchInstance.black
        var matchEnded = matchInstance.match.getIsGameOver()
        let user = await client.users.fetch(newTurnPlayerId)
        if (!matchEnded)
        {
            user.send({ content: `Rakibin ${move} oynadı. Sıra sende`, ephemeral: true })
        } else
        {
            await user.send({ content: `Rakibin ${move} oynadı`, ephemeral: true })
        }



    }

    async onMatchEnded(matchInstance, matchResult)
    {
        const whitePlayer = client.users.fetch(matchInstance.white)
        const blackPlayer = client.users.fetch(matchInstance.black)

        var turn = matchInstance.match.getTurn()
        var whiteBoard = ChessboardBuilder.create()
            .setFen(matchInstance.match.getFen())
            .setPov("w")
        var blackBoard = ChessboardBuilder.create()
            .setFen(matchInstance.match.getFen())
            .setPov(b)
        if (matchResult === MatchResult.BlackWins || matchResult === MatchResult.WhiteWins)
        {
            if (turn === "w")
            {
                await whitePlayer.send({ files: [await whiteBoard.generateBuffer()], content: "Tebrikler, sen kazandın!", ephemeral: true })
                await blackPlayer.send({ files: [await blackBoard.generateBuffer()], content: "Rakibin kazandı", ephemeral: true })
            } else
            {
                await blackPlayer.send({ files: [await blackBoard.generateBuffer()], content: "Tebrikler, sen kazandın!", ephemeral: true })
                await whitePlayer.send({ files: [await whiteBoard.generateBuffer()], content: "Rakibin kazandı", ephemeral: true })
            }
        }
        else
        {
            switch (matchResult)
            {
                case MatchResult.Draw:
                    await whitePlayer.send({ files: [await whiteBoard.generateBuffer()], content: "Maç sona erdi, berabere.", ephemeral: true })
                    await blackPlayer.send({ files: [await blackBoard.generateBuffer()], content: "Maç sone erdi, berabere.", ephemeral: true })
                    break;
                case MatchResult.Stalemate:
                    await whitePlayer.send({ files: [await whiteBoard.generateBuffer()], content: "Maç sona erdi, pat.", ephemeral: true })
                    await blackPlayer.send({ files: [await blackBoard.generateBuffer()], content: "Maç sone erdi, pat.", ephemeral: true })
                    break;
            }
        }

        this.removeMatch(matchInstance)
    }

    removeMatch(matchInstance)
    {
        this.matches.filter(x => x != matchInstance);
    }

    getActiveMatchCount()
    {
        return this.matches.length;
    }

    getMatchOfPlayer(playerId)
    {
        for (let i = 0; i < this.getActiveMatchCount(); i++)
        {
            let match = this.matches[i];
            if (match.white === playerId || match.black === playerId)
            {
                return match
            }
        }
        return null;
    }

    getIsPlayerInQueue(playerId)
    {
        return this.matchmakingQueue.includes(playerId);
    }

    isValidForMatch(playerIdA, playerIdB)
    {
        return playerIdA !== playerIdB;
    }
}

class MatchInstance
{
    constructor(white, black, match)
    {
        this.white = white
        this.black = black
        this.match = match
    }

    getColorOfId(id)
    {
        return this.white === id ? "w" : "b"
    }

    resign(color)
    {
        this.match.resign(color)
    }
}

// TODO: do not use singleton maybe?

module.exports = {
    BlindfoldSystem
}