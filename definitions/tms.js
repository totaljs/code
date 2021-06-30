// Misc
const base = 'userid:String,username:String,ua:String,ip:String,dttms:Date,projectid:String,project:String,projectpath:String';

// Files
NEWPUBLISH('files-read',   [base, 'name:String,filename:String'].join(',')); // Also triggered when file is downloaded
NEWPUBLISH('files-create', [base, 'path:String,folder:Boolean,clone:String'].join(','));
NEWPUBLISH('files-remove', [base, 'path:String'].join(','));
NEWPUBLISH('files-rename', [base, 'oldpath:String,newpath:String'].join(','));
NEWPUBLISH('files-upload', [base, 'changes:Number,combo:Number,path:String,time:Number'].join(','));

// Account
NEWPUBLISH('accounts-save', 'Accounts');

// Projects
NEWPUBLISH('projects-create',    'Projects');
NEWPUBLISH('projects-update',    'Projects');
NEWPUBLISH('projects-remove',     base);
NEWPUBLISH('projects-debugclear', base);

// Helper
FUNC.tms = function($, data, project) {
	if (!data) data = {};

	var result = CLONE(data);

	result.ua = $.ua;
	result.ip = $.ip;
	result.dttms = NOW;

	if ($.user) {
		result.userid = $.user.id;
		result.username = $.user.name;
	}

	if (project) {
		result.projectid = project.id;
		result.project = project.name;
		result.projectpath = project.path;
	}

	return result;
};