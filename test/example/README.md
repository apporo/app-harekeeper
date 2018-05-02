# app-harekeeper-example

Change to example directory:

```shell
cd test/example
```

Install dependencies:

```shell
npm install
```

Run the server:

```shell
node index.js
```

Open editor:

```curl
http://localhost:7979/jsoneditor/editor/harekeeper/index
```

Create sample messages (RabbitMQ management web):

* headers > requestId ~ "1"
* content: {"msg": "Hello world"}
