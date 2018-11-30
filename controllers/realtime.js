const MSG_OPEN = { TYPE: 'open' };
const MSG_CLOSE = { TYPE: 'close' };

exports.install = function() {
	WEBSOCKET('/', realtime, ['authorize'], 1024);
};

function realtime() {
	var self = this;
	self.autodestroy(() => MAIN.ws = null);
	MAIN.ws = self;

	self.on('open', function(client) {

		var old = self.find(conn => conn.user === client.user && conn.id !== client.id);
		if (old) {
			old.send(MSG_CLOSE);
			setTimeout(() => old.close, 1000);
		}

		client.user.online = true;
	});

	self.on('close', function(client) {
		var offline = self.find(conn => conn.user === client.user && conn.id !== client.id) == null;
		if (offline) {
			client.user.ts = 0;
			client.user.fileid && refresh_collaborators(self, client.user);
			client.user.openid = '';
			client.user.projectid = '';
			client.user.fileid = '';
			client.user.online = false;
		}
	});

	self.on('message', function(client, msg) {
		// TYPE = [e]dit
		if (msg[9] === 'e') {
			msg = msg.parseJSON();
			client.user.fileid && refresh_collaborators(self, client.user);
			client.user.projectid = msg.projectid;
			client.user.openid = (msg.openid || 0).toString();
			client.user.fileid = msg.fileid;
			client.user.ts = Date.now();
			refresh_collaborators(self, client.user, true);
		} else
			self.send2(msg, openidcomparer);
	});
}

function openidcomparer(client, msg) {
	return msg.indexOf(client.user.openid) !== -1;
}

function refresh_collaborators(ws, user, add) {

	MSG_OPEN.userid = user.id;
	MSG_OPEN.projectid = user.projectid;
	MSG_OPEN.fileid = user.fileid;
	MSG_OPEN.project = [];
	MSG_OPEN.file = [];

	for (var i = 0; i < MAIN.users.length; i++) {

		var item = MAIN.users[i];

		if (!item.fileid || (item.id === user.id && !add))
			continue;

		if (item.projectid === MSG_OPEN.projectid) {
			MSG_OPEN.project.push({ id: item.id, name: item.name });
			if (item.fileid === MSG_OPEN.fileid)
				MSG_OPEN.file.push({ id: item.id, name: item.name, ts: item.ts });
		}
	}

	MSG_OPEN.file.length && ws.send(MSG_OPEN);
}