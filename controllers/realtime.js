
const MSG_OPEN = { TYPE: 'open' };

exports.install = function() {
	WEBSOCKET('/', realtime, ['json', 'authorize']);
};

function realtime() {
	var self = this;
	self.autodestroy(() => MAIN.ws = null);
	MAIN.ws = self;

	self.on('open', function(client) {
		client.user.online++;
	});

	self.on('close', function(client) {
		var index = client.user.open.findIndex('connid', client.id);
		var open = client.user.open[index];

		if (index !== -1)
			client.user.open.splice(index, 1);

		client.user.online--;
		refresh_collaborators(self, client.user, false, open);
	});

	self.on('message', function(client, msg) {
		switch (msg.TYPE) {
			case 'edit':
				var open = client.user.open.findItem('connid', client.id);
				if (open) {
					refresh_collaborators(self, client.user, false, open);
					open.projectid = msg.projectid;
					open.fileid = msg.fileid;
				} else {
					open = { connid: client.id, projectid: msg.projectid, fileid: msg.fileid };
					client.user.open.push(open);
				}
				refresh_collaborators(self, client.user, true, open);
				break;
			case 'sync':
				self.send(msg);
				break;
		}
	});
}

function refresh_collaborators(ws, user, add, open) {

	MSG_OPEN.userid = user.id;
	MSG_OPEN.projectid = open ? open.projectid : '';
	MSG_OPEN.fileid = open ? open.fileid : '';
	MSG_OPEN.project = [];
	MSG_OPEN.file = [];

	var cache = {};

	for (var i = 0; i < MAIN.users.length; i++) {

		var item = MAIN.users[i];

		if (!item.online) // || (item.id === user.id && !add)
			continue;

		for (var j = 0; j < item.open.length; j++) {
			var edit = item.open[j];

			if (open && edit.connid === open.connid && !add)
				continue;

			if (edit.projectid === MSG_OPEN.projectid) {

				var key = 'p' + edit.projectid + '_' + item.id;

				// A prevention for duplicating names
				if (!cache[key]) {
					MSG_OPEN.project.push({ id: item.id, name: item.name });
					cache[key] = 1;
				}

				if (edit.fileid === MSG_OPEN.fileid) {
					key = 'f' + edit.fileid + '_' + item.id;
					// A prevention for duplicating names
					if (!cache[key]) {
						MSG_OPEN.file.push({ id: item.id, name: item.name });
						cache[key] = 1;
					}
				}
			}
		}
	}

	ws.send(MSG_OPEN);
}