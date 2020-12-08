
const AWS = require("aws-sdk");
AWS.config.apiVersions = {
    dynamodb: '2012-08-10',
    // other service API versions
  };

  AWS.config.update({region:'eu-west-1'});

const sqs = new AWS.SQS();

const domains = new Map()

class changesBuffer {
    backlog = new Map()
    next(topic:topic){
        if(!this.backlog.has(topic.name)) this.backlog.set(topic.name,topic)
    }
    fire(){
        this.backlog.forEach((_topic,_key)=>{
            //send updates
            this.backlog.delete(_key)
        })
    }

    constructor(){
        setInterval(() => {
            this.fire()
        }, 500);
    }
}

const mylogbuffer = new changesBuffer()

class topic {
    //name:string = 'default'
    count=0
    countCompleted = 0;
    otherNodesCount = 0;
    otherNodesCompletedCount = 0;
    completed = false;
    constructor(public name = 'default',public domain = "default", public QueueUrl?:string, public totalCount?:number, public completeUrl?:string){
        var params = {
            QueueName: this.QueueUrl || this.domain + "_" + this.name//'STRING_VALUE', /* required */
            // Attributes: {
            //   '<QueueAttributeName>': 'STRING_VALUE',
            //   /* '<QueueAttributeName>': ... */
            // },
            // tags: {
            //   '<TagKey>': 'STRING_VALUE',
            //   /* '<TagKey>': ... */
            // }
          };
        if(!this.QueueUrl) sqs.createQueue(params).promise().then((data:any)=>{
            this.QueueUrl = data.QueueUrl; 
            this.updateOtherNodes()
        });

        if(!domains.has(this.domain)) domains.set(this.domain, new Map())
        const topics = domains.get(this.domain)
        topics.set(this.name,this)
        this.updateOtherNodes()
    }

    batchPut(msgs:any[]){
        this.count = this.count + msgs.length
        this.completed = false;
        this.updateOtherNodes()
    }

    batchDelete(ReceiptHandles:string[]){
        this.count = this.count - ReceiptHandles.length;
        this.isComplete()
        this.updateOtherNodes()
    }

    async put(msg:any){
        this.count++;
        this.completed = false;
        const _r = await sqs.sendMessage({
            MessageBody:msg.MessageBody,
            QueueUrl:this.QueueUrl,
            DelaySeconds:msg.DelaySeconds,
            MessageAttributes: msg.MessageAttributes,
        }).promise().catch(()=>{
            this.count = this.count -1;
        })
        this.updateOtherNodes()
        return _r
    }

    async delete(ReceiptHandle:string){

        const _r = await sqs.deleteMessage({
            QueueUrl: this.QueueUrl,
            ReceiptHandle:ReceiptHandle
        })
        this.count = this.count -1;
        this.isComplete()
        this.updateOtherNodes()
        return _r;
    }

    isComplete(){
        if(!this.completed && this.count == 0 && this.otherNodesCount == 0 && (!this.totalCount || (this.totalCount > 0 && this.totalCount == (this.countCompleted + this.otherNodesCompletedCount)))){
            this.topicCompleted()
        }
    }

    topicCompleted(){
        this.count = 0;
        this.otherNodesCount = 0;
        this.otherNodesCompletedCount = 0;
        this.totalCount = 0;
        this.completed = true;
        this.updateOtherNodes()
    }

    updateOtherNodes(){
        if(!!this.QueueUrl) mylogbuffer.next(this)
    }

}

const defaultTopic = new topic()

function getTopic(_domain:string,_topic:string){
    if(!domains.has(_domain)){
        domains.set(_domain, new Map())
    } 
    let _d = domains.get(_domain)
    if(!_d.has(_topic)){
       _d.set(_topic, new topic(_topic,_domain)) 
    } 
    let _t = _d.get(_topic)
    return _t
}

const express = require('express')
const app = express()
const port = 3001
app.use(express.json())
app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.post('/', function (req, res) {
    res.send('Got a POST request')
})

app.put('/message', async function (req, res) {
    const _body = req.body
    const topic:topic = getTopic(_body.domain || 'default',_body.topic || 'default')
    const _r =  await topic.put(_body)
    res.send(_r)
})

app.delete('/message ', async function (req, res) {
    const _body = req.body
    const topic:topic = getTopic(_body.domain,_body.topic)
    const _r =  await topic.delete(_body.ReceiptHandle)
    res.send(_r)
})



app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})

