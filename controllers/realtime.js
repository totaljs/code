const MSG_OPEN = { TYPE: 'open' };
const MSG_EXIT = { TYPE: 'exit' };

exports.install = function() {
	WEBSOCKET('/', realtime, ['authorize'], 1024);
};

function realtime() {
	var self = this;
	self.autodestroy(() => MAIN.ws = null);
	MAIN.ws = self;

	self.on('open', function(client) {

		//var old = self.find(conn => conn.user === client.user && conn.id !== client.id);
		//if (old) {
		//	old.send(MSG_EXIT);
		//	setTimeout(() => old.close(), 1000);
		//}

		client.user.online = true;
		client.code = { id: client.query.id };
	});

	self.on('close', function(client) {
		// var offline = self.find(conn => conn.user === client.user && conn.id !== client.id) == null;
		var offline = self.find(conn => conn.user === client.user && conn.id !== client.id) == null;
		if (offline) {

			client.code.ts = 0;
			client.code.fileid && refresh_collaborators(self, client);

			client.user.ts = 0;
			client.user.openid = '';
			client.user.projectid = '';
			client.user.fileid = '';
			client.user.online = false;
			// client.user.ts = 0;
			// client.user.fileid && refresh_collaborators(self, client.user);
			// client.user.openid = '';
			// client.user.projectid = '';
			// client.user.fileid = '';
			// client.user.online = false;
		}
	});

	self.on('message', function(client, msg) {
		// 012345678901234567890
		// {"TYPE":"syncsend"
		// {"TYPE":"syncbody"
		// {"TYPE":"syncdone"
		// {"TYPE":"synccur"
		// {"TYPE":"edit"
		if (msg[9] === 'e') {
			msg = msg.parseJSON();
			client.code.fileid && refresh_collaborators(self, client);
			client.code.projectid = msg.projectid || '';
			client.code.fileid = msg.fileid;
			client.code.openid = (msg.openid || 0).toString();
			client.code.ts = Date.now();
			refresh_collaborators(self, client, true);
		} else if (msg[9] === 's' && msg[12] === 'e')
			self.send2(msg);
		else
			self.send2(msg, openidcomparer);
	});
}

function openidcomparer(client, msg) {
	return msg.indexOf(client.user.openid) !== -1;
}

function refresh_collaborators(ws, client, add) {

	MSG_OPEN.connid = client.code.id;
	MSG_OPEN.id = client.user.id;
	MSG_OPEN.projectid = client.code.projectid;
	MSG_OPEN.fileid = client.code.fileid;
	MSG_OPEN.project = [];
	MSG_OPEN.file = [];

	for (var i = 0; i < ws._keys.length; i++) {
		var key = ws._keys[i];
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

	ws.send2(MSG_OPEN);
}