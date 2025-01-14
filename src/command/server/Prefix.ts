import { Message } from 'discord.js'
import Command, { Group } from '../Command'
import SuperClient from '../../SuperClient'
import Server from '../../structures/Server'

export default class Prefix extends Command{

    constructor(){
        super({
            name: 'setprefix',
            group: Group.SERVER,
            aliases: ['prefix', 'prefixdeğiştir'],
            description: 'commands.server.prefix.description',
            usage: 'commands.server.prefix.usage',
            permission: 'ADMINISTRATOR',
            examples: ['?']
        })
    }

    async run(client: SuperClient, server: Server, message: Message, args: string[]): Promise<boolean>{
        const prefix = args[0]
        if(!prefix) return false

        if(prefix.length > 5){
            await message.channel.send({
                embeds: [this.getErrorEmbed(server.translate('commands.server.prefix.too.long'))]
            })

            return true
        }

        await Promise.all([
            server.setPrefix(prefix),
            message.channel.send(`:comet: ${server.translate('commands.server.prefix.changed', prefix)}`)
        ])
        return true
    }

}
