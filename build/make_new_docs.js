//function call7z(fnzip0,sdir,fnames,sextra_arg){
//	if(!fnames.length){return;}
//	var s_7z_2=["7z","a"];
//	if(sextra_arg){
//		s_7z_2.push(sextra_arg);
//	}
//	s_7z_2.push("a.zip");
//	s_7z_2=s_7z_2.concat(fnames);
//	var scmd="@echo off\n"+shellcmd(["cd",sdir])+"\n"+shellcmd(s_7z_2)+"\n";
//	var scall7z=g_work_dir+"/call7z.bat";
//	if(!CreateFile(scall7z,scmd)){
//		throw new Error("can't create call7z.bat");
//	}
//	ret=shell([scall7z]);
//	if(!!ret){
//		shell(["rm",sdir+"/a.zip"]);
//		throw new Error("7z returned an error code '@1'".replace("@1",ret.toString()));
//	}
//	shell(["mv",sdir+"/a.zip",fnzip0])
//}
//
//(function(){
//	mkdir(g_bin_dir+"/templates")
//	call7z(g_bin_dir+"/templates/blank_text.mo",g_base_dir+"/build/blank_text",["*"])
//	call7z(g_bin_dir+"/templates/blank_demo.mo",g_base_dir+"/build/blank_demo",["*"])
//})();

(function(){
	mkdir(g_bin_dir+"/dict")
	UpdateTo(g_bin_dir+"/dict/en_us.aff",g_base_dir+"/build/en_US.aff")
	UpdateTo(g_bin_dir+"/dict/en_us.dic",g_base_dir+"/build/en_US.dic")
})();
