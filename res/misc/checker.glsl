vec4 shader_main(vec2 st){
	vec2 xy=coord_scale*vec2(st.x,1.0-st.y);
	vec2 xy_obj=(xy-trans)/scale;
	vec2 xy_checker=floor(xy_obj/vec2(32.));
	xy_checker-=floor(xy_checker*vec2(0.5))*vec2(2.);
	return color_0+(color_1-color_0)*abs(xy_checker.x-xy_checker.y);
}
