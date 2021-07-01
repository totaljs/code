// Misc
const base = 'userid:String,username:String,ua:String,ip:String,dttms:Date,projectid:String,project:String,projectpath:String';

// Files
NEWPUBLISH('files_read',   [base, 'name:String,filename:String'].join(',')); // Also triggered when file is downloaded
NEWPUBLISH('files_create', [base, 'path:String,folder:Boolean,clone:String'].join(','));
NEWPUBLISH('files_remove', [base, 'path:String'].join(','));
NEWPUBLISH('files_rename', [base, 'oldpath:String,newpath:String'].join(','));
NEWPUBLISH('files_upload', [base, 'changes:Number,combo:Number,path:String,time:Number'].join(','));

// Account
NEWPUBLISH('accounts_save', 'Accounts');

// Projects
NEWPUBLISH('projects_create',    'Projects');
NEWPUBLISH('projects_update',    'Projects');
NEWPUBLISH('projects_remove',     base);
NEWPUBLISH('projects_debugclear', base);

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