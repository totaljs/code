FUNC.makeignore = function(arr) {

	var ext;
	var code = ['if (P.indexOf(\'-bk.\')!==-1)return;var path=P.substring(0,P.lastIndexOf(\'/\')+1);', 'var ext=U.getExtension(P);', 'var name=U.getName(P).replace(\'.\'+ext,\'\');'];

	for (var i = 0; i < arr.length; i++) {
		var item = arr[i];
		var index = item.lastIndexOf('*.');

		if (index !== -1) {
			// only extensions on this path
			ext = item.substring(index + 2);
			item = item.substring(0, index);
			code.push('tmp=\'{0}\';'.format(item));
			code.push('if((!tmp||path===tmp)&&ext===\'{0}\')return;'.format(ext));
			continue;
		}

		ext = U.getExtension(item);

		// only filename
		index = item.lastIndexOf('/');
		code.push('tmp=\'{0}\';'.format(item.substring(0, index + 1)));
		code.push('if(path===tmp&&U.getName(\'{0}\').replace(\'.{1}\', \'\')===name&&ext===\'{1}\')return;'.format(item.substring(index + 1), ext));

		// all nested path
		var val = item.replace('*', '');
		val && code.push('if(path.startsWith(\'{0}\'))return;'.format(val));
	}

	code.push('return true');
	return new Function('P', code.join(''));
};