import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

public class TestDB {
    public static void main(String[] args) {
        String url = "jdbc:mysql://localhost:3306/creator_workflow_os?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true";
        String user = "root";
        String password = "Amankasql@23";
        try (Connection con = DriverManager.getConnection(url, user, password);
             Statement stmt = con.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT output_data FROM idea WHERE type = 'ai_csv' ORDER BY id DESC LIMIT 1")) {
            if (rs.next()) {
                String data = rs.getString("output_data");
                System.out.println("--- START DATA ---");
                System.out.println(data);
                System.out.println("--- END DATA ---");
            } else {
                System.out.println("No data found.");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
