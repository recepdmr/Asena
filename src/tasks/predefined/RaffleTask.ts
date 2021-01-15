import { DiscordAPIError, HTTPError } from 'discord.js';
import RaffleModel from '../../models/Raffle';
import Task from '../Task';
import Raffle from '../../structures/Raffle';
import Server from '../../structures/Server';

export default class RaffleTask extends Task<Raffle>{

    async onRun(): Promise<void>{
        const cursor = await RaffleModel.find({ status: 'CONTINUES' }).cursor()
        for(let raffle = await cursor.next(); raffle !== null; raffle = await cursor.next()){
            const server = await this.client.servers.get(raffle.server_id)
            if(!server) continue

            const structure = await server.raffles.get(raffle.message_id)
            const finishAt: Date = new Date(raffle.finishAt)
            const remaining: number = +finishAt - Date.now()
            if(remaining <= 60 * 1000){
                await raffle.updateOne({ status: 'ALMOST_DONE' })
                this.setInterval(remaining, structure, server)
            }else if(Date.now() >= +finishAt){
                await raffle.updateOne({ status: 'ALMOST_DONE' })
                this.setInterval(1000, structure, server)
            }
        }
    }

    protected setInterval(timeout: number, raffle: Raffle, server: Server){
        new Promise((resolve, reject) => {
            this.client
                .fetchMessage(raffle.server_id, raffle.channel_id, raffle.message_id)
                .then(async result => {
                    if(!result) return reject()

                    let isRejected = false
                    const updateCallback = async (
                        customTime: number,
                        message: string = Raffle.getAlertMessage(server),
                        alert: boolean = true
                    ) => {
                        if(!isRejected){
                            await result.edit(message, {
                                embed: raffle.getEmbed(server, alert, customTime)
                            }).catch(async (err: DiscordAPIError | HTTPError) => {
                                const guild = result.guild
                                if(guild){
                                    try{
                                        await guild.owner?.send(server.translate('errors.message'), {
                                            embed: this.client.buildErrorReporterEmbed(server.locale, guild, err)
                                        })
                                    }catch(err){
                                        isRejected = true
                                        return reject(err)
                                    }
                                }

                                isRejected = true
                                return reject(err)
                            })
                        }
                    }

                    setTimeout(async () => {
                        await updateCallback(10, Raffle.getStartMessage(server), false)
                        await this.sleep(7 * 1000)
                        await updateCallback(3)
                        await this.sleep(1000)
                        await updateCallback(2)
                        await this.sleep(1000)
                        await updateCallback(1)

                        if(!isRejected){
                            return resolve(null)
                        }
                    }, timeout - (10 * 1000))
                })
        }).catch(async () => {
            await raffle.setStatus('FINISHED')
        }).then(() => {
            super.setInterval(500, raffle, server)
        })
    }

    protected intervalCallback(raffle: Raffle, server: Server): () => void{
        return async () => {
            await raffle.finish(this.client, server)
        }
    }

    private sleep(ms: number): Promise<any>{
        return new Promise(resolve => {
            setTimeout(resolve, ms)
        })
    }

}
