import {
    ColorResolvable, Guild, GuildChannel, Message, MessageEmbed, MessageReaction, Role, Snowflake, TextChannel
} from 'discord.js';
import Structure from './Structure';
import RaffleModel, { IPartialServer, IRaffle, RaffleStatus } from '../models/Raffle';
import Timestamps from '../models/legacy/Timestamps';
import { secondsToString } from '../utils/DateTimeHelper';
import { Emojis, URLMap } from '../Constants';
import ID from '../models/legacy/ID';
import SuperClient from '../SuperClient';
import RandomArray from '../utils/RandomArray';
import LanguageManager from '../language/LanguageManager';
import { parseGiveawayTimerURL } from '../utils/Utils';

type SuperRaffle = IRaffle & Timestamps & ID

class Raffle extends Structure<typeof RaffleModel, SuperRaffle>{

    public prize: string
    public server_id: Snowflake
    public constituent_id: Snowflake
    public channel_id: Snowflake
    public message_id?: Snowflake
    public numberOfWinners: number
    public status: RaffleStatus
    public finishAt: Date
    public servers: IPartialServer[]
    public allowedRoles: Snowflake[]
    public rewardRoles: Snowflake[]
    public color?: ColorResolvable
    public winners?: Snowflake[]

    private static locale: string

    constructor(data: SuperRaffle, locale: string){
        super(RaffleModel, data)

        Raffle.locale = locale
    }

    protected patch(data: SuperRaffle){
        if(typeof data.toObject === 'function'){
            data = data.toObject() // getting virtual props
        }

        this.prize = data.prize
        this.server_id = data.server_id
        this.constituent_id = data.constituent_id
        this.channel_id = data.channel_id
        this.server_id = data.server_id
        this.message_id = data.message_id
        this.numberOfWinners = data.numberOfWinners
        this.status = data.status
        this.finishAt = data.finishAt
        this.servers = data.servers ?? []
        this.allowedRoles = data.allowedRoles ?? []
        this.rewardRoles = data.rewardRoles ?? []
        this.color = data.color
        this.winners = data.winners ?? []
    }

    protected identifierKey(): string{
        return 'message_id'
    }

    public isContinues(): boolean{
        return this.status === 'CONTINUES'
    }

    public async setStatus(status: RaffleStatus){
        await this.update({ status })
    }

    public isCancelable(): boolean{
        return this.isContinues()
    }

    public async setCanceled(){
        await this.setStatus('CANCELED')
    }

    private translate(key: string, ...args: Array<string | number>){
        return LanguageManager.translate(Raffle.locale, key, ...args)
    }

    public async finish(client: SuperClient){
        await this.setStatus('FINISHED')

        const channel: GuildChannel | undefined = await client.fetchChannel(this.server_id, this.channel_id)
        if(channel instanceof TextChannel){
            const message: Message | undefined = await channel.messages.fetch(this.message_id)
            if(message instanceof Message){
                const winners: string[] = await this.identifyWinners(message)
                const winnersOfMentions: string[] = winners.map(winner => `<@${winner}>`)

                let description, content
                switch(winners.length){
                    case 0:
                        description = this.translate('structures.raffle.winners.none.description')
                        content = this.translate('structures.raffle.winners.none.content')
                        break

                    case 1:
                        description = `${this.translate('structures.raffle.winners.single.description')}: <@${winners[0]}>`
                        content = this.translate('structures.raffle.winners.single.content', winnersOfMentions.join(', '), this.prize)
                        break

                    default:
                        description = `${this.translate('structures.raffle.winners.plural.description')}:\n${winnersOfMentions.map(winner => `:small_blue_diamond: ${winner}`).join('\n')}`
                        content = this.translate('structures.raffle.winners.plural.content', winnersOfMentions.join(', '), this.prize)
                        break
                }

                const embed: MessageEmbed = new MessageEmbed()
                    .setAuthor(this.prize)
                    .setDescription([
                        `:medal: ${description}`,
                        `:reminder_ribbon: ${this.translate('structures.raffle.embed.fields.creator')}: <@${this.constituent_id}>`
                    ].join('\n'))
                    .setFooter(`${this.translate('structures.raffle.embed.footer.text', this.numberOfWinners)} | ${this.translate('structures.raffle.embed.footer.finish')}`)
                    .setTimestamp(new Date(this.finishAt))
                    .setColor('#36393F')

                await Promise.all([
                    message.edit({
                        content: `${Emojis.CONFETTI_REACTION_EMOJI} **${this.translate('structures.raffle.messages.finish')}** ${Emojis.CONFETTI_REACTION_EMOJI}`,
                        embeds: [embed]
                    }),
                    message.reply(`${Emojis.CONFETTI_EMOJI} ${content}`),
                    this.resolveWinners(client, channel.guild, winners)
                ])
            }
        }
    }

    public async identifyWinners(
        message: Message,
        numberOfWinners: number = this.numberOfWinners
    ): Promise<string[]>{
        const winners = []
        if(message){
            message = await message.fetch(true)

            let reaction: MessageReaction | undefined = await message.reactions.cache.get(Emojis.CONFETTI_REACTION_EMOJI)
            if(!reaction) return winners

            const [_, users] = (await reaction.users.fetch()).partition(user => user.bot)
            const userKeys = [...users.keys()].filter(user_id => user_id !== this.constituent_id)

            if(userKeys.length > numberOfWinners){
                const array = new RandomArray(userKeys)
                array.shuffle()
                winners.push(...array.random(numberOfWinners))
            }else{
                winners.push(...userKeys)
            }
        }

        return winners
    }

    public async resolveWinners(client: SuperClient, guild: Guild, winners: string[]){
        const embed = new MessageEmbed()
            .setAuthor(`${this.translate('structures.raffle.winner.embed.title')} 🏅`)
            .setDescription([
                `:gift: ${this.translate('structures.raffle.winner.embed.fields.prize')}: **${this.prize}**`,
                `:star: ${this.translate('structures.raffle.winner.embed.fields.server')}: **${guild.name}**`,
                `:link: **[${this.translate('structures.raffle.winner.embed.fields.link')}](${this.messageURL})**`,
                `:rocket: **[${this.translate('global.vote')}](${URLMap.VOTE})** • **[${this.translate('structures.raffle.winner.embed.fields.invite')}](${URLMap.INVITE})**`
            ].join('\n'))
            .setFooter('Powered by Asena', guild.iconURL())
            .setTimestamp()
            .setColor('GREEN')

        let rewardRoles: Role[] = []
        if(this.rewardRoles.length > 0 && guild.me.permissions.has('MANAGE_ROLES')){
            const fetchRoles = await guild.roles.fetch()
            rewardRoles = [...fetchRoles.values()].filter(role =>
                this.rewardRoles.includes(role.id) &&
                role.comparePositionTo(guild.me.roles.highest) < 0
            )
        }

        const promises: Promise<unknown>[] = winners.map(winner => new Promise(() => {
            guild.members.fetch(winner).then(async user => {
                await Promise.all([
                    user.roles.add(rewardRoles),
                    user.send({ embeds: [embed] }).catch(_ => {})
                ])
            })
        }))

        await Promise.all([
            promises,
            async () => {
                if(rewardRoles.length > 0){
                    await this.update({ winners }, false)
                    this.winners = winners
                }
            }
        ])
    }

    public get messageURL(): string{
        return `https://discord.com/channels/${this.server_id}/${this.channel_id}/${this.message_id}`
    }

    public static getStartMessage(): string{
        return `${Emojis.CONFETTI_EMOJI} **${LanguageManager.translate(this.locale, 'structures.raffle.messages.start')}** ${Emojis.CONFETTI_EMOJI}`
    }

    public static getAlertMessage(): string{
        return `${Emojis.CONFETTI_EMOJI} **${LanguageManager.translate(this.locale, 'structures.raffle.messages.alert')}** ${Emojis.CONFETTI_EMOJI}`
    }

    public buildEmbed(alert: boolean = false, rm: number = undefined): MessageEmbed{
        const length = Math.ceil((+this.finishAt - +this.createdAt) / 1000)
        const time = secondsToString(length, Raffle.locale)
        const remaining = secondsToString(rm ?? Math.ceil((+this.finishAt - Date.now()) / 1000), Raffle.locale)

        const description = [
            `:star: ${this.translate('structures.raffle.embed.fields.join', Emojis.CONFETTI_REACTION_EMOJI)}`,
            `:alarm_clock: ${this.translate('global.date-time.time')}: **${time}**`,
            `:calendar: ${this.translate('structures.raffle.embed.fields.to.end')}: **${remaining}**`,
            `:reminder_ribbon: ${this.translate('structures.raffle.embed.fields.creator')}: <@${this.constituent_id}>`,
            `:rocket: **[${this.translate('structures.raffle.embed.fields.timer')}](${parseGiveawayTimerURL(this.createdAt, length)})** • **[${this.translate('global.vote')}](${URLMap.VOTE})**`
        ]
        if(this.isAdvancedEmbed){
            const roleToString = roles => roles.map(role => `<@&${role}>`).join(', ')
            const [checkOfRewardRoles, checkOfServers, checkOfAllowedRoles] = [
                this.rewardRoles.length === 0,
                this.servers.length === 0,
                this.allowedRoles.length === 0
            ]

            description.push(...[
                ' ',
                checkOfRewardRoles ? undefined : `:mega: ${this.translate('structures.raffle.embed.fields.prize.roles')}: ${roleToString(this.rewardRoles)}`,
                checkOfServers ? undefined : `:mega: ${this.translate('structures.raffle.embed.fields.should.servers')}: **${this.servers.map(server => `[${server.name}](${server.invite})`).join(', ')}**`,
                checkOfAllowedRoles ? undefined : `:mega: ${this.translate('structures.raffle.embed.fields.should.roles')}: ${roleToString(this.allowedRoles)}`,
            ].filter(Boolean))
        }

        return new MessageEmbed()
            .setAuthor(this.prize)
            .setDescription(description.join('\n'))
            .setColor(alert ? 'RED' : this.color ?? '#bd087d')
            .setTimestamp(this.finishAt)
            .setFooter(`${this.translate('structures.raffle.embed.footer.text', this.numberOfWinners)} | ${this.translate('structures.raffle.embed.footer.continues')}`)
    }

    private get isAdvancedEmbed(): boolean{
        return this.rewardRoles.length !== 0 ||
            this.servers.length !== 0 ||
            this.allowedRoles.length !== 0
    }

}

export default Raffle
