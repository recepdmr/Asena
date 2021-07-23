import Command, { Group } from '../Command';
import SuperClient from '../../SuperClient';
import { Message, MessageEmbed } from 'discord.js';
import Constants, { ILetter } from '../../Constants';
import regional from '../../utils/RegionalIndicator';
import Server from '../../structures/Server';

export default class Question extends Command{

    constructor(){
        super({
            name: 'question',
            group: Group.POLL,
            aliases: ['sorusor', 'soru'],
            description: 'commands.survey.question.description',
            usage: 'commands.survey.question.usage',
            permission: 'ADMINISTRATOR',
            examples: [
                '{question} [answer 1] [answer 2] [answer n]',
                '{1 + 1} [2] [11]'
            ]
        });
    }

    async run(client: SuperClient, server: Server, message: Message, args: string[]): Promise<boolean>{
        if(args.length < 2) return false

        const content = args.join(' ')

        const questions = (content.match(Constants.QUESTION_REGEX) || []).map(item => {
            return item.replace(Constants.QUESTION_REPLACE_REGEX, '')
        })
        const answers = (content.match(Constants.ANSWER_REGEX) || []).map(item => {
            return item.replace(Constants.ANSWER_REPLACE_REGEX, '')
        })

        const question = questions.shift()
        if(!question || answers.length === 0) return false

        if(questions.length !== 0){
            await message.channel.send({
                embed: this.getErrorEmbed(server.translate('commands.survey.question.too.many'))
            })

            return true
        }

        if(answers.length > Constants.MAX_ANSWER_LENGTH){
            await message.channel.send({
                embed: this.getErrorEmbed(server.translate('commands.survey.question.max.answer', Constants.MAX_ANSWER_LENGTH))
            })

            return true
        }

        let i: number = 0
        const emojis: ILetter[] = []
        const embed = new MessageEmbed()
            .setTitle(question)
            .setDescription(
                answers
                    .map(answer => {
                        const emoji = Constants.LETTERS[i++]
                        emojis.push(emoji)

                        return `${regional`${emoji.name}`} ${answer}`
                    })
                    .join('\n\n')
            )
            .setColor('#5DADE2')

        message.channel.send({
            embed
        }).then(vote => {
            emojis.map(item => vote.react(item.emoji))
        }).catch(async () => {
            await message.channel.send(':boom: ' + server.translate('commands.survey.question.error'))
        })

        if(message.guild.me.hasPermission('MANAGE_MESSAGES')){
            await message.delete({
                timeout: 0
            })
        }

        return true
    }

}
