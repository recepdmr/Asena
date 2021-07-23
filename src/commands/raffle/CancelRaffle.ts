import { Message } from 'discord.js'
import Command, { Group } from '../Command'
import Constants from '../../Constants'
import SuperClient from '../../SuperClient';
import Server from '../../structures/Server';

export default class CancelRaffle extends Command{

    constructor(){
        super({
            name: 'cancel',
            group: Group.GIVEAWAY,
            aliases: ['çekilişiptalet', 'çekilişiiptalet', 'cekilisiptal', 'çekilişiptal', 'cancelraffle'],
            description: 'commands.raffle.cancel.description',
            usage: 'global.message-id',
            permission: 'ADMINISTRATOR',
            examples: [
                '',
                '111111111111111111'
            ]
        })
    }

    async run(client: SuperClient, server: Server, message: Message, args: string[]): Promise<boolean>{
        let message_id: string | undefined = args[0]
        if(message_id && !this.isValidSnowflake(message_id)){
            await message.channel.send({
                embed: this.getErrorEmbed(server.translate('global.invalid.id'))
            })
            return true
        }

        const raffle = await (message_id ? server.raffles.get(message_id) : server.raffles.getLastCreated())
        if(!raffle || !raffle.message_id){
            await message.channel.send({
                embed: this.getErrorEmbed(server.translate('commands.raffle.cancel.not.found'))
            })
            return true
        }

        if(!raffle.isCancelable()){
            await message.channel.send({
                embed: this.getErrorEmbed(server.translate('commands.raffle.cancel.not.cancelable'))
            })
            return true
        }

        await raffle.setCanceled()
        const $message = await client.fetchMessage(raffle.server_id, raffle.channel_id, raffle.message_id)
        if($message){
            await $message.delete({
                timeout: 0
            })
        }

        await message.channel.send(`${Constants.CONFETTI_EMOJI} ${server.translate('commands.raffle.cancel.success')}`)
        if(message.guild.me.hasPermission('MANAGE_MESSAGES')){
            await message.delete({
                timeout: 0
            })
        }

        return true;
    }

}
