const Moralis = require("moralis/node");
const { timer } = require("rxjs");
const allNFTFromFile = require('../cssc-metadata.json')
const fs = require('fs');

const serverUrl = "https://symwnrkbjhdg.usemoralis.com:2053/server"; //Moralis Server Url here
const appId = "3FFjNCw5XPfTp9IB8i5iiISrdERpT4B75IW8sB4e"; //Moralis Server App ID here
Moralis.start({ serverUrl, appId });

const resolveLink = (url) => {
  if (!url || !url.includes("ipfs://")) return url;
  return url.replace("ipfs://", "https://gateway.ipfs.io/ipfs/");
};

const collectionAddress = "0xB382Fcd0263f4e338437F3e9DdB445063A818D6c"; //Collection Address Here
const collectionName = "CSSC"; //CollectioonName Here


function getSeatWeight(val) {
  // eslint-disable-next-line default-case
  switch (val) {
    case 'HOUSE':
      return 500;
    case 'BOX':
      return 250
    case 'BALCONY':
      return 150;
    case 'STALL':
      return 100;
  }
}

function getSeatMultiplier(current) {
  for (let i = 0; i < current.length; i++) {
    if (current[i].trait_type === 'Seat') {
      const seatVal = current[i].value;
      return getSeatWeight(seatVal);
    }
  }
}

async function generateRarity() {
  const NFTs = await Moralis.Web3API.token.getAllTokenIds({
    address: collectionAddress,
    chain: "bsc"
  });

  const totalNum = NFTs.total;
  const pageSize = NFTs.page_size;
  console.log(totalNum);
  console.log(pageSize);
  let allNFTs = NFTs.result;
  console.log(allNFTs);

  const timer = (ms) => new Promise((res) => setTimeout(res, ms));

  for (let i = pageSize; i < totalNum; i = i + pageSize) {
    const NFTs = await Moralis.Web3API.token.getAllTokenIds({
      address: collectionAddress,
      offset: i,
    });
    allNFTs = allNFTs.concat(NFTs.result);
    console.log(allNFTs);
    await timer(6000);
  }

  // let metadata1 = allNFTs.map((e) => JSON.parse(e.metadata).attributes);
  let metadata = allNFTFromFile.map((e) => e.attributes);

  let tally = { TraitCount: {} };

  for (let j = 0; j < metadata.length; j++) {
    let nftTraits = metadata[j].map((e) => e.trait_type);
    let nftValues = metadata[j].map((e) => e.value);

    let numOfTraits = nftTraits.length;

    if (tally.TraitCount[numOfTraits]) {
      tally.TraitCount[numOfTraits]++;
    } else {
      tally.TraitCount[numOfTraits] = 1;
    }

    for (let i = 0; i < nftTraits.length; i++) {
      let current = nftTraits[i];
      if (tally[current]) {
        tally[current].occurences++;
      } else {
        tally[current] = { occurences: 1 };
      }

      let currentValue = nftValues[i];
      if (tally[current][currentValue]) {
        tally[current][currentValue]++;
      } else {
        tally[current][currentValue] = 1;
      }
    }
  }

  const collectionAttributes = Object.keys(tally);
  let nftArr = [];
  for (let j = 0; j < metadata.length; j++) {
    let current = metadata[j];
    let totalRarity = 0;
    for (let i = 0; i < current.length; i++) {
      let rarityScore =
        1 / (tally[current[i].trait_type][current[i].value] / (totalNum * getSeatMultiplier(current)));
      current[i].rarityScore = rarityScore;
      totalRarity += rarityScore;
    }


    let rarityScoreNumTraits = (1 / (tally.TraitCount[Object.keys(current).length] / totalNum));
    current.push({
      trait_type: "TraitCount",
      value: Object.keys(current).length,
      rarityScore: rarityScoreNumTraits,
    });
    totalRarity += rarityScoreNumTraits;

    if (current.length < collectionAttributes.length) {
      let nftAttributes = current.map((e) => e.trait_type);
      let absent = collectionAttributes.filter(
        (e) => !nftAttributes.includes(e)
      );

      absent.forEach((type) => {
        let rarityScoreNull =
          1 / ((totalNum - tally[type].occurences) / totalNum);
        current.push({
          trait_type: type,
          value: null,
          rarityScore: rarityScoreNull,
        });
        totalRarity += rarityScoreNull;
      });
    }

    // if (allNFTs[j].metadata) {
    //   allNFTs[j].metadata = JSON.parse(allNFTs[j].metadata);
    //   allNFTs[j].image = resolveLink(allNFTs[j].metadata.image);
    // } else if (allNFTs[j].token_uri) {
    //   try {
    //     await fetch(allNFTs[j].token_uri)
    //       .then((response) => response.json())
    //       .then((data) => {
    //         allNFTs[j].image = resolveLink(data.image);
    //       });
    //   } catch (error) {
    //     console.log(error);
    //   }
    // }

    nftArr.push({
      Attributes: current,
      Rarity: totalRarity,
      token_id: allNFTFromFile[j].name.split('STAR #')[1],
      // image: allNFTs[j].image,
    });
  }

  nftArr.sort((a, b) => b.Rarity - a.Rarity);

  for (let i = 0; i < nftArr.length; i++) {
    nftArr[i]['Rank'] = i + 1;
  }

  //write
  fs.writeFile('rarity-rank.json', JSON.stringify(nftArr), (err) => {
    if (err) {
      throw err;
    }
    console.log("JSON data is saved.");
  });
  // for (let i = 0; i < nftArr.length; i++) {
  //   nftArr[i].Rank = i + 1;
  //   const newClass = Moralis.Object.extend(collectionName);
  //   const newObject = new newClass();

  //   newObject.set("attributes", nftArr[i].Attributes);
  //   newObject.set("rarity", nftArr[i].Rarity);
  //   newObject.set("tokenId", nftArr[i].token_id);
  //   newObject.set("rank", nftArr[i].Rank);
  //   newObject.set("image", nftArr[i].image);

  //   await newObject.save();
  //   console.log(i);
  // }

  return true
}

generateRarity()
  .then((result) => { console.log(result) })
  .catch((error) => { console.log(error) })
