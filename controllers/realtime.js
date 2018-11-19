
const MSG_OPEN = { TYPE: 'open' };

exports.install = function() {
	WEBSOCKET('/', realtime, ['json', 'authorize']);
};

function realtime() {
	var self = this;
	self.autodestroy(() => MAIN.ws = null);
	MAIN.ws = self;

	self.on('open', function(client) {
		client.user.online = true;
	});

	self.on('close', function(client) {
		client.user.projectid && refresh_collaborators(self, client.user);
		client.user.projectid = '';
		client.user.fileid = '';
		client.user.online = false;
	});

	self.on('message', function(client, msg) {
		switch (msg.TYPE) {
			case 'edit':
				client.user.projectid && refresh_collaborators(self, client.user);
				client.user.projectid = msg.projectid;
				client.user.fileid = msg.fileid;
				refresh_collaborators(self, client.user, true);
				break;
		}
	});
}

function refresh_collaborators(ws, user, add) {

	MSG_OPEN.userid = user.id;
	MSG_OPEN.projectid = user.projectid;
	MSG_OPEN.fileid = user.fileid;
	MSG_OPEN.project = [];
	MSG_OPEN.file = [];

	for (var i = 0; i < MAIN.users.length; i++) {

		var item = MAIN.users[i];

		if (item.id === user.id && !add)
			continue;

		if (item.projectid === MSG_OPEN.projectid) {
			MSG_OPEN.project.push({ id: item.id, name: item.name });
			if (item.fileid === MSG_OPEN.fileid)
				MSG_OPEN.file.push({ id: item.id, name: item.name });
		}
	}

	ws.send(MSG_OPEN);
}
