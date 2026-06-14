function test(){
    const res = createWorkspace("ferdyasino@gmail.com");
    Logger.log(res);
}
function testInsertTimeLog() {
  const workspaceId = "1SltJ7TVMSIF4ubqr-KuY3l1QM6xWoaLnRlko7Sy1gSA";

  const result = insertTimeLog(workspaceId, {
    user_id: "U001",
    email: "test@example.com",
    action: "time_out",
    shift_id: "SHIFT_1",
    device_info: "Chrome Desktop",
    location: "Cotabato",
    remarks: "test log"
  });

  console.log(result);
}
function testGetLog(){
  const email = "ferdyasino@gmail.com";
  const workspaceId = "1SltJ7TVMSIF4ubqr-KuY3l1QM6xWoaLnRlko7Sy1gSA";
  const timelogs = findTimeLogs(workspaceId, {email});
  // const logsNow = getTodayTimeLogsByEmail(workspaceId,email);
  console.log("logSheet",timelogs);
}

function testInsertEmployee() {
  const workspaceId = "1SltJ7TVMSIF4ubqr-KuY3l1QM6xWoaLnRlko7Sy1gSA";

  const result = createUser(workspaceId, {
    email: "carlos.billones.jr@example.com",
    first_name: "Carlos",
    last_name: "Billones Jr",
    department_id: "DEP-001",
    shift_id: "SHIFT-001"
  });

  Logger.log(result);
}

function testImportUsers() {

  const workspaceId = "1SltJ7TVMSIF4ubqr-KuY3l1QM6xWoaLnRlko7Sy1gSA";

  const users = [
    {
      email: "carlo.arda@example.com",
      first_name: "Carlo",
      last_name: "Arda",
      department_id: "DEP-001",
      shift_id: "SHIFT-001",
      role: "EMPLOYEE"
    },
    {
      email: "carlos.billones.jr@example.com",
      first_name: "Carlos",
      last_name: "Billones Jr",
      department_id: "DEP-002",
      shift_id: "SHIFT-001",
      role: "EMPLOYEE"
    },
    {
      email: "new.user@example.com",
      first_name: "New",
      last_name: "User",
      department_id: "DEP-003",
      shift_id: "SHIFT-002",
      role: "EMPLOYEE"
    }
  ];

  const result = importUsers(workspaceId, users, {
    skipIfExists: true
  });

  Logger.log(JSON.stringify(result, null, 2));
}

function testlogin(){
    const workspaceId = "1SltJ7TVMSIF4ubqr-KuY3l1QM6xWoaLnRlko7Sy1gSA";
    const email = "ferdyasino@gmail.com";

    const login = loginResolver(workspaceId, email);
    Logger.log(login);
    console.log("login", login);
}