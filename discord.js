import dotenv from 'dotenv'
import { Client, GatewayIntentBits, MessageFlags } from 'discord.js';
import axios from 'axios';

dotenv.config();

const client = new Client({
  intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
  });

const riot_key = process.env.RIOT_API_KEY;
const discord_token = process.env.DISCORD_TOKEN;
const region = 'br1';

// Função para puxar id do player
async function getAccountData(gameName, tagLine) {
  const url = `https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
  
  const res = await axios.get(url, {
    headers: { 'X-Riot-Token': riot_key },
  });

  return res.data; // Contém: puuid, gameName, tagLine
}

// Função que busca o rank do player
async function getRankData(encryptedPuuId) {
    const url = `https://${region}.api.riotgames.com/lol/league/v4/entries/by-puuid/${encryptedPuuId}`;
  const res = await axios.get(url, {
    headers: {'X-Riot-Token': riot_key},
  });
  return res.data;
}

client.once('ready', () => {
  console.log(`Logado como ${client.user.tag}`);

  // Aqui você coloca o ID do canal onde quer mandar a mensagem
  const channelId = '1374510538729590836';

  const channel = client.channels.cache.get(channelId);
  if (!channel) {
    console.log('Canal não encontrado');
    return;
  }

  channel.send('Se é você que vai pagar eu to dentro');
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.channel.name !== 'papo-furado') return;

  if (message.content.startsWith('!elo ')) {
    const summonerName = message.content.slice(5).trim();
    const [gameName, tagline] = summonerName.split('#') 

    try {
      const account = await getAccountData(gameName, tagline);
      const rankData = await getRankData(account.puuid);

      if (rankData.length === 0) {
        message.channel.send(`O Jogador **${summonerName}** não tem rank.`);
        return;
      }

      const soloRank = rankData.find((r) => r.queueType === 'RANKED_SOLO_5x5');

      if (!soloRank) {
        message.channel.send(`O jogador **${summonerName}** não tem rank na Solo/Duo.`);
        return;
      }

      const { tier, rank, leaguePoints, wins, losses } = soloRank;
      const totalGames = wins + losses;
      const winRate = ((wins / totalGames) * 100).toFixed(2);


      message.channel.send(
         `📊 **${summonerName}** está em **${tier} ${rank}** com ${leaguePoints} LP. ` +
          `Vitórias: ${wins}, Derrotas: ${losses} (Winrate: ${winRate}%)`
      );

    } catch (error) {
      console.error(error);
      message.channel.send(`Erro ao buscar dados para **${summonerName}**.`);
    }
  }

  if (message.content.startsWith('!cargo ')) {

    const summonerName = message.content.slice(7).trim();
    const [gameName, tagline] = summonerName.split('#') 

    const account = await getAccountData(gameName, tagline);
    const rankData = await getRankData(account.puuid);
    
    // Pega o rank solo/duo igual no !elo
    const soloRank = rankData.find(r => r.queueType === 'RANKED_SOLO_5x5');
    if (!soloRank) {
      message.channel.send(`O jogador **${summonerName}** não tem rank na Solo/Duo.`);
      return;
    }

    console.log(soloRank)
    const roleName = soloRank.tier;

    const role = message.guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
    if (!role) {
      try {
        role = await message.guild.roles.create({
          name: roleName,
          color: 'Random',
          reason: `Cargo criado automaticamente para o tier ${roleName}`
        });
      } catch (error) {
        console.error('Erro ao criar o cargo: ',error);
        message.channel.send(`❌ Não consegui criar o cargo **${roleName}**.`);
        return;
      }
    }

    try {
      const member = message.member;
      const botHighest = message.guild.members.me.roles.highest.position;
      const rolePos = role.position;

      if (rolePos >= botHighest) {
        message.channel.send("❌ Esse cargo está acima ou no mesmo nível que o meu, não posso atribuí-lo.");
        return;
      }

      await member.roles.add(role);
      message.channel.send(`✅ Cargo "${role.name}" adicionado para ${member.user.username}.`)
    } catch (error) {
      console.error(error);
      message.channel.send("❌ Ocorreu um erro ao tentar adicionar o cargo.");
    }
  }
});

client.login(discord_token);