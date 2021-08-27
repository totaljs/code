const MSG_OPEN = { TYPE: 'open' };
const MSG_ONLINE = { TYPE: 'online' };
const MSG_OFFLINE = { TYPE: 'offline' };

exports.install = function() {
	ROUTE('+SOCKET /internal/', realtime, ['text'], 1024);
};

function realtime() {
	var self = this;
	self.autodestroy(() => MAIN.ws = null);
	MAIN.ws = self;

	self.on('open', function(client) {
		client.user.online = true;
		client.code = { id: client.query.id };
		MSG_ONLINE.id = client.user.id;
		self.send(MSG_ONLINE);
	});

	self.on('close', function(client) {

		client.code.ts = 0;
		client.code.fileid && refresh_collaborators(self, client);

		// var offline = self.find(conn => conn.user === client.user && conn.id !== client.id) == null;
		var offline = self.find(conn => conn.user === client.user) == null;
		if (offline) {
			client.user.online = false;
			MSG_OFFLINE.id = client.user.id;
			self.send(MSG_OFFLINE);
		}
	});

	self.on('message', function(client, msg) {

		// 012345678901234567890
		// {"TYPE":"syncsend"
		// {"TYPE":"syncbody"
		// {"TYPE":"syncdone"
		// {"TYPE":"synccur"
		// {"TYPE":"edit"
		// {"TYPE":"online"
		// {"TYPE":"offline"
		// {"TYPE":"refresh"
		// {"TYPE":"x" -> spawn destroy
		if (msg[9] === 'e') {
			msg = msg.parseJSON();
			if (msg) {
				client.code.fileid && refresh_collaborators(self, client);
				client.code.projectid = msg.projectid || '';
				client.code.fileid = msg.fileid;
				client.code.openid = (msg.openid || 0).toString();
				client.code.ts = Date.now();
				refresh_collaborators(self, client, true);
			}
		} else if (msg[9] === 's' && msg[12] === 'e')
			self.send(msg);
		else if (msg[9] === 'x') {
			msg = msg.parseJSON();
			if (MAIN.spawns[msg.id]) {
				MAIN.spawns[msg.id].kill(9);
			}
		} else if (msg[9] === 'r')
			self.send(msg);
		else
			self.send(msg, openidcomparer);
	});
}

function openidcomparer(client, msg) {
	return msg.indexOf('":' + client.code.openid) !== -1;
}

function refresh_collaborators(ws, client, add) {

	MSG_OPEN.connid = client.code.id;
	MSG_OPEN.id = client.user.id;
	MSG_OPEN.projectid = client.code.projectid;
	MSG_OPEN.fileid = client.code.fileid;
	MSG_OPEN.project = [];
	MSG_OPEN.file = [];

	for (var i = 0; i < ws.keys.length; i++) {
		var key = ws.keys[i];
		var con = ws.connections[key];

		if (!con.code.fileid || (con.code.id !== client.code.id && !add))
			continue;

		if (con.code.projectid === MSG_OPEN.projectid) {
			MSG_OPEN.project.push({ connid: con.code.id, id: con.user.id, name: con.user.name });
			if (con.code.fileid === MSG_OPEN.fileid)
				MSG_OPEN.file.push({ connid: con.code.id, id: con.user.id, name: con.user.name, ts: con.code.ts });
		}
	}

	if (add)
		MSG_OPEN.TYPE = 'open';
	else
		MSG_OPEN.TYPE = 'close';

	ws.send(MSG_OPEN);
}