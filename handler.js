"use strict";
const { get } = require('axios')
class Handler {
  constructor({rekoSvc, translateSvc}) {
    this.rekoSvc = rekoSvc
    this.translateSvc = translateSvc
  }

  async detectImageLabels(buffer) {
    const result = await this.rekoSvc.detectLabels({
      Image: {
        Bytes: buffer
      }
    }).promise()

    const workItems = result.Labels
      .filter(({Confidence}) => Confidence > 80)

    const names = workItems
      .map(({Name}) => Name)
      .join(' and ')

    return { names, workItems }
  }

  async translateToPortuguese(text) {
    const params = {
      SourceLanguageCode: 'en',
      TargetLanguageCode: 'pt',
      Text: text
    }

    const { TranslatedText } = await this.translateSvc
      .translateText(params)
      .promise()
    
    return TranslatedText.split(' e ')
  }

  formatTextResults(texts, workItems) {
    const finalText = []
    for(const indexText in texts) {
      const nameInPortuguese = texts[indexText]
      const confidence = workItems[indexText].Confidence
      finalText.push(
        `${confidence.toFixed(2)}% de ser do tipo ${nameInPortuguese}`
      )
    }

    return finalText.join('\n')
  }

  async getImageBuffer(imageUrl) {
    const response = await get(imageUrl, {
      responseType: 'arraybuffer'
    })

    const buffer = Buffer.from(response.data, 'base64')
    return buffer
  }

  async main(event) {
    try {
      const { imageUrl } = event.queryStringParameters
      const buffer = await this.getImageBuffer(imageUrl)
      const { names, workItems } = await this.detectImageLabels(buffer)
      const text = await this.translateToPortuguese(names)
      const finalText = this.formatTextResults(text, workItems)
      return {
        statusCode: 200,
        body: finalText
      }
    } catch (error) {
      console.log('[ERROR]', error.stack)
      return {
        statusCode: 500,
        body: 'Internal Server Error'
      }
    }
  }
}

const aws = require('aws-sdk')
const reko = new aws.Rekognition()
const translator = new aws.Translate()
const handler = new Handler({
  rekoSvc : reko,
  translateSvc: translator
})
module.exports.main = handler.main.bind(handler)