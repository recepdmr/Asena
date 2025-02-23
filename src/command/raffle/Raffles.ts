import { Message, MessageEmbed } from 'discord.js'
import Command, { Group } from '../Command'
import { Emojis } from '../../Constants'
import { parseDiscordTimestamp } from '../../utils/DateTimeHelper'
import SuperClient from '../../SuperClient'
import Server from '../../structures/Server'

export default class Raffles extends Command{

    constructor(){
        super({
            name: 'raffles',
            group: Group.GIVEAWAY,
            aliases: ['giveaway', 'giveaways', 'çekilişler', 'cekilisler', 'list'],
            description: 'commands.raffle.list.description',
            usage: null,
            permission: undefined,
            examples: []
        })
    }

    async run(client: SuperClient, server: Server, message: Message, args: string[]): Promise<boolean>{
        const raffles = await server.raffles.getContinues()
        const embed: MessageEmbed = new MessageEmbed()
            .setAuthor(`${message.guild.name} | ${server.translate('commands.raffle.list.embed.title')}`)
            .setColor('#DDA0DD')
            .setFooter(`${message.guild.name} ${server.translate('commands.raffle.list.embed.footer')}`)
            .setTimestamp()

        if(raffles.length === 0){
            embed.setDescription(`${Emojis.CONFETTI_REACTION_EMOJI} ${server.translate('commands.raffle.list.embed.description.active.not.found')}`)
        }else{
            let i: number = 1;
            raffles.map(raffle => {
                const data = {
                    creator: `<@${raffle.constituent_id}>`,
                    channel: `<#${raffle.channel_id}>`,
                    'winner.count': `**${raffle.numberOfWinners}**`,
                    start: `**${parseDiscordTimestamp(raffle.createdAt)}**`,
                    finish: `**${parseDiscordTimestamp(raffle.finishAt)}**`
                }

                embed.addField(`${i++}. ${raffle.prize}`, Object.entries(data).map(([key, value]) => {
                    return `${server.translate(`commands.raffle.list.embed.fields.${key}`)}: ${value}`
                }).join('\n'))
            })

            embed.setDescription(`${Emojis.CONFETTI_REACTION_EMOJI} ${server.translate('commands.raffle.list.embed.description.active.found', raffles.length)}`)
        }

        await message.channel.send({ embeds: [embed] })

        return true
    }

}
