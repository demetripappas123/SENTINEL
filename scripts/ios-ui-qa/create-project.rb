require 'xcodeproj'
require 'fileutils'
root=File.expand_path(ARGV.fetch(0))
FileUtils.mkdir_p(root)
project=Xcodeproj::Project.new("#{root}/SentinelQA.xcodeproj")
target=project.new_target(:ui_test_bundle,'SentinelQA',:ios,'17.0')
file=project.main_group.new_file(File.join(__dir__,'SentinelScreenshots.swift'))
target.add_file_references([file])
target.build_configurations.each do |config|
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER']='com.sentinel.uiqa'
  config.build_settings['GENERATE_INFOPLIST_FILE']='YES'
  config.build_settings['SWIFT_VERSION']='5.0'
  config.build_settings['CODE_SIGNING_ALLOWED']='NO'
end
project.save
scheme=Xcodeproj::XCScheme.new
scheme.configure_with_targets(target,nil)
scheme.add_test_target(target)
scheme.save_as(project.path,'SentinelQA',true)
