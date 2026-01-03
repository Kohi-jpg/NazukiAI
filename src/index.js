// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

// Discord API
import { Client, IntentsBitField } from 'discord.js';

import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

// Permissions for the bot
const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
    ],
})

// Log in to Discord with your bot token
client.login(process.env.DISCORD_TOKEN);

// Function to split long messages
function splitMessage(text, maxLength = 2000) {
    if (text.length <= maxLength) {
        return [text];
    }

    const messages = [];
    let currentMessage = '';

        // Split by lines to preserve formatting
    const lines = text.split('\n');

    for (const line of lines) {
        // If a single line is larger than the limit, split by words
        if (line.length > maxLength) {
            const words = line.split(' ');
            
            for (const word of words) {
                if ((currentMessage + word + ' ').length > maxLength) {
                    if (currentMessage) {
                        messages.push(currentMessage.trim());
                        currentMessage = '';
                    }
                    // If a word is larger than the limit, split it
                    if (word.length > maxLength) {
                        for (let i = 0; i < word.length; i += maxLength) {
                            messages.push(word.slice(i, i + maxLength));
                        }
                    } else {
                        currentMessage = word + ' ';
                    }
                } else {
                    currentMessage += word + ' ';
                }
            }
        } else {
            // Check if adding the line exceeds the limit
            if ((currentMessage + line + '\n').length > maxLength) {
                if (currentMessage) {
                    messages.push(currentMessage.trim());
                    currentMessage = '';
                }
            }
            currentMessage += line + '\n';
        }
    }

        // Add the last message if there is content
    if (currentMessage.trim()) {
        messages.push(currentMessage.trim());
    }

    return messages;
}

// Nazuki will RESPOND!!
// -- 1st: Get the message when the bot is mentioned
// -- 2nd: Send the message to OpenAI API
// -- 3rd: Get the response from OpenAI API
// -- 4th: Send the response back to Discord
client.on('messageCreate', async msg => {
    if (msg.author?.bot) return; // ignore bot messages
    // Check if the bot is mentioned
    const isMention = msg.mentions.has(client.user);
    // Only proceed when mentioned in a guild (DMs are ignored)
    if (!isMention) return;
    // Extract the message content without the mention
    const mensagem = (msg.content || '').replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();

    try {
        const systemInstruction = process.env.PROMPT;
        const promptContents = [systemInstruction, mensagem].filter(Boolean);
        // Send the message to Google GenAI API
        const response = await ai.models.generateContent({
            model: "gemma-3-27b-it",
            contents: [
                {
                    role: "user",
                    parts: [{ text: systemInstruction + "\n\nUsuário: " + mensagem }]
                }
            ]
        });
        // Log the response for debugging
        console.log(response.text);
        // Send the response back to Discord, splitting if necessary
        if (response.text) {
            const messageParts = splitMessage(response.text);
            await msg.reply(messageParts[0]);
            for (let i = 1; i < messageParts.length; i++) {
                await msg.channel.send(messageParts[i]);
            }
        } else {
            await msg.reply('I received your message but got an empty response.');
        }

    } catch (error) {
        console.error('Error getting AI response:', error);
        try { await msg.reply('Sorry, I encountered an error processing your request.'); } catch (_) {}
    }
});